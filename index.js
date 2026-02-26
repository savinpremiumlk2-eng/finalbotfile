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
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

/**
 * Infinity MD - Render Web Service Stable Entry
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
      status: activeSessions.has(id) ? 'Online' : 'Offline'
    }));
    res.json(sessionList);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/session/add', express.json(), async (req, res) => {
  const { sessionId, botName } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');
  
  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    const sessionName = sessions[sessionId]?.folder || `session_${Date.now()}`;
    const sessionFolder = path.join(__dirname, 'session', sessionName);
    
    sessions[sessionId] = { folder: sessionName, name: botName || 'Infinity MD' };
    fs.writeFileSync(sessionsDbPath, JSON.stringify(sessions, null, 2));

    if (sessionId.startsWith('KnightBot!')) {
      const zlib = require('zlib');
      const b64data = sessionId.split('!')[1];
      const decoded = zlib.gunzipSync(Buffer.from(b64data, 'base64'));
      if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });
      fs.writeFileSync(path.join(sessionFolder, 'creds.json'), decoded);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const newSock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: [botName || 'Infinity MD', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    newSock.ev.on('creds.update', saveCreds);
    newSock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        activeSessions.set(sessionId, newSock);
        console.log(`✅ Session ${sessionId} connected!`);
      }
    });

    newSock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg?.message) continue;
        try {
          await handler.handleMessage(newSock, msg);
        } catch (err) {
          console.error('Handler Error:', err);
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Session Add Error:', error);
    res.status(500).send(error.message);
  }
});

app.get('/api/stats', (req, res) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  res.json({
    uptime: `${h}h ${m}m ${s}s`,
    ram: (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Web server listening on', PORT));

// Main Bot logic
let sock = null;
let reconnectTimer = null;
let isConnecting = false;
let backoffMs = 5000;
const BACKOFF_MAX = 60000;

// Re-initialize all saved sessions on startup
async function initAllSessions() {
  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsDbPath, 'utf-8'));
    for (const id in sessions) {
      console.log(`♻️ Auto-reconnecting session: ${id}`);
      // Reuse the logic from add-session endpoint but without sending response
      const sessionData = sessions[id];
      const sessionFolder = path.join(__dirname, 'session', sessionData.folder);
      
      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
      const { version } = await fetchLatestBaileysVersion();

      const newSock = makeWASocket({
        version,
        logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: [sessionData.name || 'Infinity MD', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      newSock.ev.on('creds.update', saveCreds);
      newSock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
          activeSessions.set(id, newSock);
          console.log(`✅ Session ${id} auto-connected!`);
        }
      });

      newSock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg?.message) continue;
          try { await handler.handleMessage(newSock, msg); } catch (err) { console.error('Handler Error:', err); }
        }
      });
    }
  } catch (e) {
    console.error('Init Sessions Error:', e);
  }
}

initAllSessions();

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reasonMsg = '') {
  clearReconnectTimer();
  if (isConnecting) return;
  const wait = backoffMs;
  backoffMs = Math.min(Math.round(backoffMs * 2), BACKOFF_MAX);
  console.log(`🔁 Reconnecting in ${Math.round(wait / 1000)}s... ${reasonMsg}`);
  reconnectTimer = setTimeout(() => {
    startBot().catch((e) => console.error('Start Error:', e));
  }, wait);
}

function safeEndSocket() {
  try { if (sock) sock.end?.(); } catch (_) {} finally { sock = null; }
}

async function startBot() {
  if (isConnecting) return sock;
  isConnecting = true;
  clearReconnectTimer();

  try {
    const sessionFolder = `./${config.sessionName}`;
    if (config.sessionID && config.sessionID.startsWith('KnightBot!')) {
        const zlib = require('zlib');
        const b64data = config.sessionID.split('!')[1];
        const decoded = zlib.gunzipSync(Buffer.from(b64data, 'base64'));
        if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });
        fs.writeFileSync(path.join(sessionFolder, 'creds.json'), decoded);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();
    safeEndSocket();

    sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      browser: ['Infinity MD', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        backoffMs = 5000;
        console.log('\n✅ Infinity MD connected successfully!');
      }
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        safeEndSocket();
        if (!loggedOut) scheduleReconnect();
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg?.message) continue;
        try { await handler.handleMessage(sock, msg); } catch (err) { console.error('Handler Error:', err); }
      }
    });

    return sock;
  } finally {
    isConnecting = false;
  }
}

startBot().catch((err) => console.error('Start Error:', err));
