const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

// AntiCall module
const anticall = require('./commands/owner/anticall');

/**
 * Infinity MD - Full working index.js with AntiCall support
 */

const app = express();
const logger = pino({ level: 'silent' });
const activeSessions = new Map();
const sessionsDbPath = path.join(__dirname, 'database', 'sessions.json');

// Ensure database directory exists
if (!fs.existsSync(path.join(__dirname, 'database'))) {
  fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true });
}

// Initialize sessions DB
if (!fs.existsSync(sessionsDbPath)) {
  fs.writeFileSync(sessionsDbPath, JSON.stringify({}, null, 2));
}

// ✅ Load config/settings
require('./config');
require('./settings');
const config = require('./config');
const handler = require('./handler');
const database = require('./database');
const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');

// Initialize system
initializeTempSystem();
startCleanup();

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));

app.get('/api/sessions', (req, res) => {
  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    const sessionList = Object.keys(sessions).map(id => ({
      id,
      name: sessions[id].name,
      ownerName: sessions[id].ownerName || config.ownerName[0],
      ownerNumber: sessions[id].ownerNumber || config.ownerNumber[0],
      status: activeSessions.has(id) ? 'Online' : 'Offline'
    }));
    res.json(sessionList);
  } catch (e) {
    res.json([]);
  }
});

// Express JSON parser middleware
app.use(express.json());

// Session management endpoints
app.post('/api/session/update', async (req, res) => {
  const { sessionId, botName, ownerName, ownerNumber } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');

  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    if (sessions[sessionId]) {
      sessions[sessionId].name = botName || sessions[sessionId].name;
      sessions[sessionId].ownerName = ownerName || sessions[sessionId].ownerName;
      sessions[sessionId].ownerNumber = ownerNumber || sessions[sessionId].ownerNumber;

      if (activeSessions.has(sessionId)) {
        const sock = activeSessions.get(sessionId);
        sock._customConfig = {
          botName: sessions[sessionId].name,
          ownerName: sessions[sessionId].ownerName,
          ownerNumber: sessions[sessionId].ownerNumber
        };
      }

      fs.writeFileSync(sessionsDbPath, JSON.stringify(sessions, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).send('Session not found');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/session/delete', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');

  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    const sessionData = sessions[sessionId];

    if (activeSessions.has(sessionId)) {
      const sock = activeSessions.get(sessionId);
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.ev.removeAllListeners('creds.update');
      sock.end();
      activeSessions.delete(sessionId);
    }

    if (sessionData) {
      const sessionFolder = path.join(__dirname, 'session', sessionData.folder);
      if (fs.existsSync(sessionFolder)) fs.rmSync(sessionFolder, { recursive: true, force: true });
      delete sessions[sessionId];
      fs.writeFileSync(sessionsDbPath, JSON.stringify(sessions, null, 2));
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/session/restart', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');

  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    const sessionData = sessions[sessionId];
    if (!sessionData) return res.status(404).send('Session not found');

    if (activeSessions.has(sessionId)) {
      const oldSock = activeSessions.get(sessionId);
      oldSock.ev.removeAllListeners('connection.update');
      oldSock.end();
      activeSessions.delete(sessionId);
    }

    await connectSession(sessionId, sessionData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

async function connectSession(id, sessionData) {
  const sessionFolder = path.join(__dirname, 'session', sessionData.folder);
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    browser: [sessionData.name || 'Infinity MD', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  sock._customConfig = {
    botName: sessionData.name || 'Infinity MD',
    ownerName: sessionData.ownerName || config.ownerName[0],
    ownerNumber: sessionData.ownerNumber || config.ownerNumber[0]
  };

  // Save credentials
  sock.ev.on('creds.update', saveCreds);

  // Connection updates
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      activeSessions.set(id, sock);
      console.log(`✅ Session ${id} connected!`);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode || DisconnectReason.restartRequired;
      activeSessions.delete(id);
      console.log(`❌ Session ${id} disconnected (code: ${code})`);
      setTimeout(() => connectSession(id, sessionData), 5000);
    }
  });

  // Messages handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg?.message) continue;
      try { await handler.handleMessage(sock, msg); } catch (err) { console.error(err); }
    }
  });

  // AntiCall handler
  sock.ev.on('call', async (calls) => {
    for (const c of calls) await anticall.onCall(sock, c);
  });

  activeSessions.set(id, sock);
  return sock;
}

app.post('/api/session/add', async (req, res) => {
  const { sessionId, botName, ownerName, ownerNumber } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');

  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    const sessionFolder = `session_${Date.now()}`;
    sessions[sessionId] = {
      folder: sessionFolder,
      name: botName || 'Infinity MD',
      ownerName: ownerName || config.ownerName[0],
      ownerNumber: ownerNumber || config.ownerNumber[0]
    };
    fs.writeFileSync(sessionsDbPath, JSON.stringify(sessions, null, 2));

    await connectSession(sessionId, sessions[sessionId]);
    res.json({ success: true });
  } catch (e) {
    console.error('Session add error:', e);
    res.status(500).send(e.message);
  }
});

// Global settings endpoints
app.get('/api/global-settings', (req, res) => res.json(database.getGlobalSettings()));
app.post('/api/global-settings/update', async (req, res) => {
  const settings = req.body;
  database.updateGlobalSettings(settings);

  for (const [id, sock] of activeSessions.entries()) {
    const jid = sessions[id]?.ownerNumber ? `${sessions[id].ownerNumber}@s.whatsapp.net` : config.ownerNumber[0] + '@s.whatsapp.net';
    try { await sock.sendMessage(jid, { text: '⚙️ Global settings updated.' }); } catch {} 
  }
  res.json({ success: true });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  res.json({ uptime: `${h}h ${m}m ${s}s`, ram: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server listening on ${PORT}`));

// Initialize all saved sessions
(async function initAllSessions() {
  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    for (const id in sessions) {
      await connectSession(id, sessions[id]);
    }
    if (config.sessionID && !sessions[config.sessionID]) {
      await connectSession(config.sessionID, {
        folder: 'session',
        name: config.botName || 'Infinity MD',
        ownerName: config.ownerName[0],
        ownerNumber: config.ownerNumber[0]
      });
    }
  } catch (e) {
    console.error('Init sessions error:', e);
  }
})();
