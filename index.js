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

// Ensure session directory exists
if (!fs.existsSync(path.join(__dirname, 'session'))) {
  fs.mkdirSync(path.join(__dirname, 'session'), { recursive: true });
}

// ✅ Load config/settings
require('./config');
require('./settings');
const config = require('./config');
const handler = require('./handler');
const database = require('./database');
const auth = require('./utils/auth');
const session = require('express-session');
const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');

// Initialize system
initializeTempSystem();
startCleanup();

app.use(express.json());
app.use(session({
  secret: 'infinity-md-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

const isAuthenticated = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
};

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'views/signup.html')));

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const authResult = await auth.login(username, password);
  if (authResult) {
    req.session.loggedIn = true;
    req.session.username = authResult.username;
    req.session.isOwner = authResult.isOwner || false;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  if (await auth.register(username, password)) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.get('/', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));

app.get('/api/sessions', isAuthenticated, async (req, res) => {
  try {
    const sessions = await database.getAllSessions();
    const isOwner = req.session.isOwner;
    const userSessions = Object.keys(sessions)
      .filter(id => isOwner || sessions[id].userId === req.session.username)
      .map(id => ({
        id,
        name: sessions[id].name,
        ownerName: sessions[id].ownerName || config.ownerName[0],
        ownerNumber: sessions[id].ownerNumber || config.ownerNumber[0],
        settings: sessions[id].settings || {},
        status: activeSessions.has(id) ? 'Online' : 'Offline',
        userId: sessions[id].userId // Helpful for owner to see whose bot it is
      }));
    res.json(userSessions);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/session/update', isAuthenticated, async (req, res) => {
  const { sessionId, botName, ownerName, ownerNumber, settings } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');
  
  try {
    const sessions = await database.getAllSessions();
    const isOwner = req.session.isOwner;
    if (sessions[sessionId] && (isOwner || sessions[sessionId].userId === req.session.username)) {
      sessions[sessionId].name = botName || sessions[sessionId].name;
      sessions[sessionId].ownerName = ownerName || sessions[sessionId].ownerName;
      sessions[sessionId].ownerNumber = ownerNumber || sessions[sessionId].ownerNumber;
      sessions[sessionId].settings = settings || sessions[sessionId].settings || {};

      // Update active socket config if session is online
      if (activeSessions.has(sessionId)) {
        const sock = activeSessions.get(sessionId);
        sock._customConfig = {
          botName: sessions[sessionId].name,
          ownerName: sessions[sessionId].ownerName,
          ownerNumber: sessions[sessionId].ownerNumber,
          settings: sessions[sessionId].settings
        };
      }

      await database.saveSession(sessionId, sessions[sessionId]);
      res.json({ success: true });
    } else {
      res.status(404).send('Session not found');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/session/delete', isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');

  try {
    const sessions = await database.getAllSessions();
    const isOwner = req.session.isOwner;
    if (sessions[sessionId] && !isOwner && sessions[sessionId].userId !== req.session.username) {
      return res.status(403).send('Forbidden');
    }
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
      await database.deleteSession(sessionId);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/session/restart', isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');

  try {
    const sessions = await database.getAllSessions();
    const isOwner = req.session.isOwner;
    if (sessions[sessionId] && !isOwner && sessions[sessionId].userId !== req.session.username) {
      return res.status(403).send('Forbidden');
    }
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
  
  // Ensure session folder exists
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  // Handle KnightBot! session ID decoding if needed
  if (id && id.startsWith('KnightBot!')) {
    try {
      const zlib = require('zlib');
      const b64data = id.split('!')[1];
      const decoded = zlib.gunzipSync(Buffer.from(b64data, 'base64'));
      fs.writeFileSync(path.join(sessionFolder, 'creds.json'), decoded);
    } catch (e) {
      console.error(`Error decoding KnightBot session ${id}:`, e.message);
    }
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
    browser: [sessionData.name || 'Infinity MD', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  newSock._customConfig = {
     botName: sessionData.name || 'Infinity MD',
     ownerName: sessionData.ownerName || config.ownerName[0],
     ownerNumber: sessionData.ownerNumber || config.ownerNumber[0],
     settings: sessionData.settings || {}
  };

  newSock.ev.on('creds.update', saveCreds);
  
  // Anti-Call Listener
  newSock.ev.on('call', async (callUpdate) => {
    for (const call of callUpdate) {
      if (call.status === 'offer') {
        try {
          const anticall = require('./commands/owner/anticall');
          if (anticall && typeof anticall.onCall === 'function') {
            await anticall.onCall(newSock, call);
          }
        } catch (e) {
          console.error('Call handling error:', e);
        }
      }
    }
  });

  newSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      activeSessions.set(id, newSock);
      console.log(`✅ Session ${id} connected!`);
    }
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : lastDisconnect?.error?.output?.statusCode;
      
      const sessions = await database.getAllSessions();
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const isDeleted = !sessions[id] && id !== config.sessionID;

      if (isLoggedOut || isDeleted) {
        activeSessions.delete(id);
        console.log(`❌ Session ${id} stopped (${isLoggedOut ? 'Logged out' : 'Deleted'})`);
      } else {
        console.log(`🔄 Reconnecting session ${id} (Status: ${statusCode})...`);
        setTimeout(() => connectSession(id, sessionData), 5000);
      }
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

app.post('/api/session/add', isAuthenticated, async (req, res) => {
  const { sessionId, botName, ownerName, ownerNumber } = req.body;
  if (!sessionId) return res.status(400).send('Missing session ID');
  
  try {
    const sessions = await database.getAllSessions();
    const sessionName = sessions[sessionId]?.folder || `session_${Date.now()}`;
    const sessionFolder = path.join(__dirname, 'session', sessionName);
    
    sessions[sessionId] = { 
      userId: req.session.username,
      folder: sessionName, 
      name: botName || 'Infinity MD',
      ownerName: ownerName || config.ownerName[0],
      ownerNumber: ownerNumber || config.ownerNumber[0],
      addedAt: Date.now()
    };
    await database.saveSession(sessionId, sessions[sessionId]);

    if (sessionId.startsWith('KnightBot!')) {
      const zlib = require('zlib');
      const b64data = sessionId.split('!')[1];
      const decoded = zlib.gunzipSync(Buffer.from(b64data, 'base64'));
      if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });
      fs.writeFileSync(path.join(sessionFolder, 'creds.json'), decoded);
    }

    await connectSession(sessionId, sessions[sessionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Session Add Error:', error);
    res.status(500).send(error.message);
  }
});

app.get('/api/user-info', isAuthenticated, (req, res) => {
  res.json({
    username: req.session.username,
    isOwner: req.session.isOwner || false
  });
});

app.get('/api/global-settings', isAuthenticated, async (req, res) => {
  res.json(await database.getGlobalSettings());
});

app.post('/api/global-settings/update', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) {
    return res.status(403).json({ success: false, message: 'Only owner can update global settings' });
  }
  const settings = req.body;
  await database.updateGlobalSettings(settings);
  
  // Notify all active sessions
  const sessions = await database.getAllSessions();
  for (const [id, sock] of activeSessions.entries()) {
    let targetNum = '';
    if (id === config.sessionID) {
      targetNum = config.ownerNumber[0];
    } else if (sessions[id]) {
      targetNum = sessions[id].ownerNumber;
    }
    
    if (targetNum) {
      const jid = targetNum.includes('@') ? targetNum : `${targetNum}@s.whatsapp.net`;
      const msg = `⚙️ *Global Settings Updated*\n\n` + 
                  Object.entries(settings).map(([k, v]) => `• ${k}: ${v ? 'ON' : 'OFF'}`).join('\n') +
                  `\n\n_Changes applied instantly._`;
      try { 
        await sock.sendMessage(jid, { text: msg });
        console.log(`Sent update message to owner ${targetNum} for session ${id}`);
      } catch (e) {
        console.error(`Failed to send update message to owner ${targetNum}:`, e.message);
      }
    }
  }
  
  res.json({ success: true });
});

app.get('/api/stats', isAuthenticated, (req, res) => {
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
    const sessions = await database.getAllSessions();
    for (const id in sessions) {
      console.log(`♻️ Auto-reconnecting session: ${id}`);
      await connectSession(id, sessions[id]);
    }

    // Connect global session from config if it exists and isn't in dashboard sessions
    if (config.sessionID && !sessions[config.sessionID]) {
       console.log('♻️ Connecting global session from config.js');
       const globalSessionData = {
         folder: config.sessionName || 'session',
         name: config.botName || 'Infinity MD (Global)',
         ownerName: config.ownerName[0],
         ownerNumber: config.ownerNumber[0]
       };
       await connectSession(config.sessionID, globalSessionData);
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

function safeEndSocket() {
  try { if (sock) sock.end?.(); } catch (_) {} finally { sock = null; }
}
