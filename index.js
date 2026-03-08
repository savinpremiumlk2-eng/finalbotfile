const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Infinity MD - Render Web Service Stable Entry
 * Raw HTTP server starts INSTANTLY for healthchecks, then Express + modules load after.
 */

const PORT = process.env.PORT || 3000;
let app, server, serverReady = false;

const activeSessions = new Map();
const sessionsDbPath = path.join(__dirname, 'database', 'sessions.json');

let pino, Boom, makeWASocket, useMultiFileAuthState, DisconnectReason,
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers,
    jidNormalizedUser, baileysDelay, QRCode, pn, logger;
let config, handler, database, auth;

server = http.createServer((req, res) => {
  if (!app) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  app(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Web server listening on', PORT);

  process.on('uncaughtException', (err) => {
    const msg = err?.message || '';
    if (msg.includes('Decipheriv') || msg.includes('Bad MAC') || msg.includes('decrypt')) {
      console.error('⚠️ Caught Baileys decryption error (non-fatal):', msg);
    } else {
      console.error('⚠️ Uncaught exception (kept alive):', err);
    }
  });
  process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled rejection (kept alive):', reason?.message || reason);
  });

  setTimeout(() => {
    const express = require('express');
    app = express();

    app.get('/', (req, res) => {
      res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/login"><title>Infinity MD</title></head><body>OK</body></html>');
    });

    app.use(express.json());
    app.use(require('express-session')({
      secret: 'infinity-md-secret',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }
    }));

    pino = require('pino');
    ({ Boom } = require('@hapi/boom'));
    ({
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
      Browsers,
      jidNormalizedUser,
      delay: baileysDelay,
    } = require('@whiskeysockets/baileys'));
    QRCode = require('qrcode');
    pn = require('awesome-phonenumber');
    logger = pino({ level: 'silent' });

    if (!fs.existsSync(path.join(__dirname, 'session'))) {
      fs.mkdirSync(path.join(__dirname, 'session'), { recursive: true });
    }

    try {
      require('./config');
      require('./settings');
      config = require('./config');
      handler = require('./handler');
      database = require('./database');
      auth = require('./utils/auth');
      const { initializeTempSystem } = require('./utils/tempManager');
      const { startCleanup } = require('./utils/cleanup');
      initializeTempSystem();
      startCleanup();
      console.log('✅ All modules loaded successfully');
    } catch (e) {
      console.error('❌ Critical module loading error:', e);
      if (!config) config = require('./config');
      if (!database) {
        try { database = require('./database'); } catch (_) {
          console.error('❌ Database module failed to load');
        }
      }
      if (!auth) {
        try { auth = require('./utils/auth'); } catch (_) {
          console.error('❌ Auth module failed to load');
        }
      }
      if (!handler) {
        console.error('❌ Handler module failed to load - bot commands will not work');
      }
    }

    registerRoutes();
    serverReady = true;
    initSessions();
  }, 0);
});

async function connectSession(id, sessionData) {
  const sessionFolder = path.join(__dirname, 'session', sessionData.folder);

  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  if (!fs.existsSync(path.join(sessionFolder, 'creds.json')) && sessionData.creds) {
    fs.writeFileSync(path.join(sessionFolder, 'creds.json'), sessionData.creds);
  }

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
     settings: sessionData.settings || {},
     userId: sessionData.userId
  };

  if (newSock.ws) {
    newSock.ws.on('error', (err) => {
      console.error(`⚠️ WebSocket error for session ${id.substring(0, 20)}...:`, err?.message || err);
    });
  }

  newSock.ev.on('creds.update', async () => {
    await saveCreds();
    const credsData = fs.readFileSync(path.join(sessionFolder, 'creds.json'), 'utf8');
    await database.saveSessionCreds(id, credsData);
  });

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
      sessionData._retryCount = 0;
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
        if (!sessionData._retryCount) sessionData._retryCount = 0;
        sessionData._retryCount++;
        const delay = Math.min(5000 * Math.pow(1.5, sessionData._retryCount - 1), 120000);
        console.log(`🔄 Reconnecting session ${id} (Status: ${statusCode}, attempt ${sessionData._retryCount}, delay ${Math.round(delay/1000)}s)...`);
        setTimeout(() => connectSession(id, sessionData), delay);
      }
    }
  });

  newSock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    if (!handler || typeof handler.handleMessage !== 'function') {
      console.error('Handler not loaded - cannot process messages');
      return;
    }
    for (const msg of messages) {
      if (!msg?.message) continue;
      try { await handler.handleMessage(newSock, msg); } catch (err) { console.error('Handler Error:', err); }
    }
  });
}

function registerRoutes() {

const isAuthenticated = (req, res, next) => {
  if (!serverReady) {
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({ success: false, message: 'Server is starting up, please wait...' });
    }
    return res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="3"><title>Starting...</title></head><body>Server is starting up, please wait...</body></html>');
  }
  if (req.session && req.session.loggedIn) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  return res.redirect('/login');
};

app.get('/login', (req, res) => {
  if (req.session && req.session.loggedIn) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views/login.html'));
});
app.get('/signup', (req, res) => {
  if (req.session && req.session.loggedIn) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views/signup.html'));
});

app.post('/api/auth/login', async (req, res) => {
  if (!serverReady || !auth) return res.status(503).json({ success: false, message: 'Server is starting up, please wait...' });
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
  if (!serverReady || !auth) return res.status(503).json({ success: false, message: 'Server is starting up, please wait...' });
  const { username, password } = req.body;
  if (await auth.register(username, password)) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'User already exists' });
  }
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/dashboard', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));

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
          settings: sessions[sessionId].settings,
          userId: sessions[sessionId].userId
        };
      }

      await database.saveSession(sessionId, sessions[sessionId]);
      
      // Notify owner via WhatsApp
      const targetNum = sessions[sessionId].ownerNumber;
      if (targetNum) {
        const jid = targetNum.includes('@') ? targetNum : `${targetNum}@s.whatsapp.net`;
        const msg = `✅ *Bot Settings Updated*\n\n` +
                    `• Bot Name: ${sessions[sessionId].name}\n` +
                    `• Owner: ${sessions[sessionId].ownerName}\n` +
                    `• Settings: ${JSON.stringify(sessions[sessionId].settings)}\n\n` +
                    `_Changes applied successfully._`;
        
        // Try to find an active socket to send the message
        const sock = activeSessions.get(sessionId) || Array.from(activeSessions.values())[0];
        if (sock) {
          try {
            await sock.sendMessage(jid, { text: msg });
          } catch (e) {
            console.error(`Failed to notify owner for session ${sessionId}:`, e.message);
          }
        }
      }
      
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

const pairSessions = new Map();

app.post('/api/pair', isAuthenticated, async (req, res) => {
  const { number, botName, ownerName, ownerNumber } = req.body;
  if (!number) return res.status(400).json({ success: false, message: 'Phone number is required' });

  const cleaned = number.replace(/[^0-9]/g, '');
  if (!cleaned || cleaned.length < 7 || cleaned.length > 15) {
    return res.status(400).json({ success: false, message: 'Invalid phone number. Enter your full international number (e.g., 15551234567 for US, 447911123456 for UK) without + or spaces.' });
  }
  let num;
  try {
    const phone = pn('+' + cleaned);
    if (!phone.isValid()) {
      return res.status(400).json({ success: false, message: 'Invalid phone number. Enter your full international number (e.g., 15551234567 for US, 447911123456 for UK) without + or spaces.' });
    }
    num = phone.getNumber('e164').replace('+', '');
  } catch (phoneErr) {
    num = cleaned;
  }

  const pairId = `pair_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const pairDir = path.join(__dirname, 'session', pairId);
  fs.mkdirSync(pairDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(pairDir);
    const { version } = await fetchLatestBaileysVersion();

    const pairSock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
      },
      printQRInTerminal: false,
      logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
      browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });

    pairSessions.set(pairId, pairSock);

    pairSock.ev.on('creds.update', saveCreds);

    let pairDeployed = false;

    pairSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        pairDeployed = true;
        console.log(`✅ Pair session ${pairId} connected!`);
        try {
          const credsData = fs.readFileSync(path.join(pairDir, 'creds.json'), 'utf8');

          const sessionName = `session_${Date.now()}`;
          const sessionFolder = path.join(__dirname, 'session', sessionName);
          fs.mkdirSync(sessionFolder, { recursive: true });

          const files = fs.readdirSync(pairDir);
          for (const f of files) {
            if (fs.statSync(path.join(pairDir, f)).isFile()) {
              fs.copyFileSync(path.join(pairDir, f), path.join(sessionFolder, f));
            }
          }

          const sessionId = `paired_${num}_${Date.now()}`;
          const sessionData = {
            userId: req.session.username,
            folder: sessionName,
            name: botName || 'Infinity MD',
            ownerName: ownerName || config.ownerName[0],
            ownerNumber: ownerNumber || num,
            addedAt: Date.now(),
            creds: credsData
          };
          await database.saveSession(sessionId, sessionData);
          await connectSession(sessionId, sessionData);

          console.log(`✅ Pair session auto-deployed as ${sessionId}`);
        } catch (err) {
          console.error('Error deploying pair session:', err);
        }

        setTimeout(() => {
          try { pairSock.end(); } catch (_) {}
          pairSessions.delete(pairId);
          fs.rmSync(pairDir, { recursive: true, force: true });
        }, 5000);
      }

      if (connection === 'close' && !pairDeployed) {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

        if (isLoggedOut) {
          console.log(`❌ Pair session ${pairId} logged out, cleaning up`);
          pairSessions.delete(pairId);
          try { fs.rmSync(pairDir, { recursive: true, force: true }); } catch (_) {}
        } else {
          console.log(`🔄 Pair session ${pairId} disconnected (status: ${statusCode}), retrying...`);
          try {
            try { pairSock.ev.removeAllListeners(); pairSock.end(); } catch (_) {}
            const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState(pairDir);
            const { version: newVersion } = await fetchLatestBaileysVersion();

            const retrySock = makeWASocket({
              version: newVersion,
              auth: {
                creds: newState.creds,
                keys: makeCacheableSignalKeyStore(newState.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
              },
              printQRInTerminal: false,
              logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
              browser: Browsers.windows('Chrome'),
              markOnlineOnConnect: false,
              generateHighQualityLinkPreview: false,
              defaultQueryTimeoutMs: 60000,
              connectTimeoutMs: 60000,
              keepAliveIntervalMs: 30000,
            });

            retrySock.ev.on('creds.update', newSaveCreds);
            retrySock.ev.on('connection.update', async (retryUpdate) => {
              const { connection: rc, lastDisconnect: rld } = retryUpdate;
              if (rc === 'open') {
                pairDeployed = true;
                console.log(`✅ Pair session ${pairId} connected on retry!`);
                try {
                  const credsData = fs.readFileSync(path.join(pairDir, 'creds.json'), 'utf8');
                  const sessionName = `session_${Date.now()}`;
                  const sessionFolder = path.join(__dirname, 'session', sessionName);
                  fs.mkdirSync(sessionFolder, { recursive: true });
                  const files = fs.readdirSync(pairDir);
                  for (const f of files) {
                    if (fs.statSync(path.join(pairDir, f)).isFile()) {
                      fs.copyFileSync(path.join(pairDir, f), path.join(sessionFolder, f));
                    }
                  }
                  const sessionId = `paired_${num}_${Date.now()}`;
                  const sessionData = {
                    userId: req.session.username,
                    folder: sessionName,
                    name: botName || 'Infinity MD',
                    ownerName: ownerName || config.ownerName[0],
                    ownerNumber: ownerNumber || num,
                    addedAt: Date.now(),
                    creds: credsData
                  };
                  await database.saveSession(sessionId, sessionData);
                  await connectSession(sessionId, sessionData);
                  console.log(`✅ Pair session auto-deployed as ${sessionId}`);
                } catch (err) {
                  console.error('Error deploying pair retry session:', err);
                }
                setTimeout(() => {
                  try { retrySock.end(); } catch (_) {}
                  pairSessions.delete(pairId);
                  fs.rmSync(pairDir, { recursive: true, force: true });
                }, 5000);
              }
              if (rc === 'close' && !pairDeployed) {
                const rCode = (rld?.error instanceof Boom) ? rld.error.output?.statusCode : rld?.error?.output?.statusCode;
                console.log(`❌ Pair session ${pairId} retry also closed (status: ${rCode}), cleaning up`);
                pairSessions.delete(pairId);
                try { fs.rmSync(pairDir, { recursive: true, force: true }); } catch (_) {}
              }
            });

            pairSessions.set(pairId, retrySock);
          } catch (retryErr) {
            console.error(`❌ Pair session ${pairId} retry failed:`, retryErr.message);
            pairSessions.delete(pairId);
            try { fs.rmSync(pairDir, { recursive: true, force: true }); } catch (_) {}
          }
        }
      }
    });

    if (!pairSock.authState.creds.registered) {
      await baileysDelay(3000);
      try {
        let code = await pairSock.requestPairingCode(num);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`🔑 Pair code for ${num}: ${code}`);

        setTimeout(() => {
          if (pairSessions.has(pairId)) {
            console.log(`⏰ Pair session ${pairId} timed out, cleaning up`);
            try { pairSessions.get(pairId).end(); } catch (_) {}
            pairSessions.delete(pairId);
            fs.rmSync(pairDir, { recursive: true, force: true });
          }
        }, 120000);

        return res.json({ success: true, code, pairId });
      } catch (err) {
        console.error('Error requesting pair code:', err);
        pairSessions.delete(pairId);
        fs.rmSync(pairDir, { recursive: true, force: true });
        return res.status(503).json({ success: false, message: 'Failed to generate pair code. Check the phone number and try again.' });
      }
    } else {
      pairSessions.delete(pairId);
      fs.rmSync(pairDir, { recursive: true, force: true });
      return res.status(400).json({ success: false, message: 'This number already has an active session.' });
    }
  } catch (err) {
    console.error('Pair session error:', err);
    fs.rmSync(pairDir, { recursive: true, force: true });
    return res.status(503).json({ success: false, message: 'Service unavailable' });
  }
});

app.get('/api/qr', isAuthenticated, async (req, res) => {
  const qrId = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const qrDir = path.join(__dirname, 'session', qrId);
  fs.mkdirSync(qrDir, { recursive: true });

  let responseSent = false;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(qrDir);
    const { version } = await fetchLatestBaileysVersion();

    const qrSock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      browser: Browsers.windows('Chrome'),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
      },
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    });

    pairSessions.set(qrId, qrSock);

    const botName = req.query.botName || 'Infinity MD';
    const ownerName = req.query.ownerName || config.ownerName[0];
    const ownerNumber = req.query.ownerNumber || config.ownerNumber[0];

    qrSock.ev.on('creds.update', saveCreds);

    let qrDeployed = false;

    qrSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !responseSent) {
        responseSent = true;
        try {
          const qrDataURL = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: { dark: '#06b6d4', light: '#0f172a' }
          });
          res.json({ success: true, qr: qrDataURL, qrId });
        } catch (qrErr) {
          res.status(500).json({ success: false, message: 'Failed to generate QR code' });
        }
      }

      if (connection === 'open') {
        qrDeployed = true;
        console.log(`✅ QR session ${qrId} connected!`);
        try {
          const credsData = fs.readFileSync(path.join(qrDir, 'creds.json'), 'utf8');

          const userJid = qrSock.authState.creds.me?.id
            ? jidNormalizedUser(qrSock.authState.creds.me.id)
            : null;
          const userNum = userJid ? userJid.split('@')[0] : '';

          const sessionName = `session_${Date.now()}`;
          const sessionFolder = path.join(__dirname, 'session', sessionName);
          fs.mkdirSync(sessionFolder, { recursive: true });

          const files = fs.readdirSync(qrDir);
          for (const f of files) {
            if (fs.statSync(path.join(qrDir, f)).isFile()) {
              fs.copyFileSync(path.join(qrDir, f), path.join(sessionFolder, f));
            }
          }

          const sessionId = `qr_${userNum || Date.now()}_${Date.now()}`;
          const sessionData = {
            userId: req.session.username,
            folder: sessionName,
            name: botName,
            ownerName: ownerName,
            ownerNumber: ownerNumber || userNum,
            addedAt: Date.now(),
            creds: credsData
          };
          await database.saveSession(sessionId, sessionData);
          await connectSession(sessionId, sessionData);

          console.log(`✅ QR session auto-deployed as ${sessionId}`);
        } catch (err) {
          console.error('Error deploying QR session:', err);
        }

        setTimeout(() => {
          try { qrSock.end(); } catch (_) {}
          pairSessions.delete(qrId);
          fs.rmSync(qrDir, { recursive: true, force: true });
        }, 5000);
      }

      if (connection === 'close' && !qrDeployed) {
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

        if (isLoggedOut) {
          console.log(`❌ QR session ${qrId} logged out, cleaning up`);
          pairSessions.delete(qrId);
          try { fs.rmSync(qrDir, { recursive: true, force: true }); } catch (_) {}
        } else {
          console.log(`🔄 QR session ${qrId} disconnected (status: ${statusCode}), retrying...`);
          try {
            try { qrSock.ev.removeAllListeners(); qrSock.end(); } catch (_) {}
            const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState(qrDir);
            const { version: newVersion } = await fetchLatestBaileysVersion();

            const retrySock = makeWASocket({
              version: newVersion,
              logger: pino({ level: 'silent' }),
              browser: Browsers.windows('Chrome'),
              auth: {
                creds: newState.creds,
                keys: makeCacheableSignalKeyStore(newState.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
              },
              markOnlineOnConnect: false,
              generateHighQualityLinkPreview: false,
              defaultQueryTimeoutMs: 60000,
              connectTimeoutMs: 60000,
              keepAliveIntervalMs: 30000,
            });

            retrySock.ev.on('creds.update', newSaveCreds);
            retrySock.ev.on('connection.update', async (retryUpdate) => {
              const { connection: rc, lastDisconnect: rld } = retryUpdate;
              if (rc === 'open') {
                qrDeployed = true;
                console.log(`✅ QR session ${qrId} connected on retry!`);
                try {
                  const credsData = fs.readFileSync(path.join(qrDir, 'creds.json'), 'utf8');
                  const userJid = retrySock.authState.creds.me?.id
                    ? jidNormalizedUser(retrySock.authState.creds.me.id)
                    : null;
                  const userNum = userJid ? userJid.split('@')[0] : '';
                  const sessionName = `session_${Date.now()}`;
                  const sessionFolder = path.join(__dirname, 'session', sessionName);
                  fs.mkdirSync(sessionFolder, { recursive: true });
                  const files = fs.readdirSync(qrDir);
                  for (const f of files) {
                    if (fs.statSync(path.join(qrDir, f)).isFile()) {
                      fs.copyFileSync(path.join(qrDir, f), path.join(sessionFolder, f));
                    }
                  }
                  const sessionId = `qr_${userNum || Date.now()}_${Date.now()}`;
                  const sessionData = {
                    userId: req.session.username,
                    folder: sessionName,
                    name: botName,
                    ownerName: ownerName,
                    ownerNumber: ownerNumber || userNum,
                    addedAt: Date.now(),
                    creds: credsData
                  };
                  await database.saveSession(sessionId, sessionData);
                  await connectSession(sessionId, sessionData);
                  console.log(`✅ QR session auto-deployed as ${sessionId}`);
                } catch (err) {
                  console.error('Error deploying QR retry session:', err);
                }
                setTimeout(() => {
                  try { retrySock.end(); } catch (_) {}
                  pairSessions.delete(qrId);
                  fs.rmSync(qrDir, { recursive: true, force: true });
                }, 5000);
              }
              if (rc === 'close' && !qrDeployed) {
                const rCode = (rld?.error instanceof Boom) ? rld.error.output?.statusCode : rld?.error?.output?.statusCode;
                console.log(`❌ QR session ${qrId} retry also closed (status: ${rCode}), cleaning up`);
                pairSessions.delete(qrId);
                try { fs.rmSync(qrDir, { recursive: true, force: true }); } catch (_) {}
              }
            });

            pairSessions.set(qrId, retrySock);
          } catch (retryErr) {
            console.error(`❌ QR session ${qrId} retry failed:`, retryErr.message);
            pairSessions.delete(qrId);
            try { fs.rmSync(qrDir, { recursive: true, force: true }); } catch (_) {}
          }
        }
      }
    });

    setTimeout(() => {
      if (!responseSent) {
        responseSent = true;
        res.status(408).json({ success: false, message: 'QR generation timed out. Try again.' });
      }
      if (!qrDeployed) {
        try { const s = pairSessions.get(qrId); if (s) s.end(); } catch (_) {}
        pairSessions.delete(qrId);
        try { fs.rmSync(qrDir, { recursive: true, force: true }); } catch (_) {}
      }
    }, 60000);

  } catch (err) {
    console.error('QR session error:', err);
    if (!responseSent) {
      responseSent = true;
      res.status(503).json({ success: false, message: 'Service unavailable' });
    }
    fs.rmSync(qrDir, { recursive: true, force: true });
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

app.get('/api/user-settings', isAuthenticated, async (req, res) => {
  const settings = await database.getUserSettings(req.session.username);
  res.json(settings);
});

app.post('/api/user-settings/update', isAuthenticated, async (req, res) => {
  const settings = req.body;
  const updated = await database.updateUserSettings(req.session.username, settings);
  res.json({ success: true, settings: updated });
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
    // Use custom config owner number if available, else fallback to session data or global config
    if (sock._customConfig?.ownerNumber) {
      const owners = Array.isArray(sock._customConfig.ownerNumber) ? sock._customConfig.ownerNumber : [sock._customConfig.ownerNumber];
      targetNum = owners[0];
    } else if (sessions[id]) {
      targetNum = sessions[id].ownerNumber;
    } else if (id === config.sessionID) {
      targetNum = config.ownerNumber[0];
    }
    
    if (targetNum) {
      const jid = targetNum.includes('@') ? targetNum : `${targetNum}@s.whatsapp.net`;
      const msg = `⚙️ *Global Settings Updated*\n\n` + 
                  Object.entries(settings).map(([k, v]) => {
                    let displayVal = v;
                    if (typeof v === 'boolean') displayVal = v ? 'ON' : 'OFF';
                    return `• ${k}: ${displayVal}`;
                  }).join('\n') +
                  `\n\n_Changes applied instantly to all bots._`;
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

app.get('/api/admin/global-settings', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  const settings = await database.getGlobalSettings();
  res.json(settings);
});

app.post('/api/admin/global-settings/update', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  const { whatsappChannel } = req.body;
  await database.updateGlobalSettings({ whatsappChannel });
  res.json({ success: true });
});

app.get('/api/user/channel', isAuthenticated, async (req, res) => {
  const settings = await database.getGlobalSettings();
  res.json({ channel: settings.whatsappChannel || '' });
});

app.get('/api/admin/stats', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  try {
    const sessions = await database.getAllSessions();
    const users = await database.query("SELECT COUNT(*) as count FROM dashboard_users");
    const activeCount = Array.from(activeSessions.keys()).length;
    
    // Additional metrics
    const botTypes = Object.values(sessions).reduce((acc, s) => {
      acc[s.name] = (acc[s.name] || 0) + 1;
      return acc;
    }, {});

    res.json({
      totalBots: Object.keys(sessions).length || 0,
      activeBots: activeCount || 0,
      totalUsers: (users && users[0] && users[0].count) || 0,
      memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB',
      botTypes
    });
  } catch (e) {
    console.error('Error fetching admin stats:', e);
    res.json({ totalBots: 0, activeBots: 0, totalUsers: 0, memory: '0 MB', botTypes: {} });
  }
});

app.get('/api/admin/users', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  try {
    const users = await database.query("SELECT username FROM dashboard_users");
    const result = Array.isArray(users) ? users : [];
    res.json(result);
  } catch (e) {
    console.error('Error fetching admin users:', e);
    res.json([]);
  }
});

app.post('/api/admin/broadcast', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  const { message, type, target, scope } = req.body;
  if (!message) return res.status(400).send('Message required');

  const icons = { info: '📢', warn: '⚠️', alert: '🚨' };
  const icon = icons[type] || '📢';
  const prefix = type === 'alert' ? '*[URGENT]* ' : '';

  let successCount = 0;
  const sessions = await database.getAllSessions();

  for (const [id, sock] of activeSessions.entries()) {
    try {
      const sessionData = sessions[id];
      const targetNum = sessionData?.ownerNumber || (id === config.sessionID ? config.ownerNumber[0] : null);
      
      if (targetNum) {
        if (scope === 'contacts') {
          // Broadcast to all contacts of this bot
          const contacts = await sock.store?.contacts || {};
          const jids = Object.keys(contacts).filter(jid => jid.endsWith('@s.whatsapp.net'));
          for (const jid of jids) {
            await sock.sendMessage(jid, { text: `${icon} ${prefix}*BROADCAST*\n\n${message}` }).catch(() => {});
          }
          successCount++;
        } else {
          // Default: Broadcast to bot owner only
          const jid = targetNum.includes('@') ? targetNum : `${targetNum}@s.whatsapp.net`;
          await sock.sendMessage(jid, { text: `${icon} ${prefix}*SYSTEM BROADCAST*\n\n${message}` });
          successCount++;
        }
      }
    } catch (e) {
      console.error(`Broadcast failed for session ${id}:`, e.message);
    }
  }
  res.json({ success: true, sentTo: successCount });
});

app.post('/api/admin/user/action', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  const { username, action } = req.body;
  
  try {
    if (action === 'delete') {
      // Find all sessions for this user and stop them
      const sessions = await database.getAllSessions();
      for (const id in sessions) {
        if (sessions[id].userId === username) {
          if (activeSessions.has(id)) {
            const sock = activeSessions.get(id);
            sock.end();
            activeSessions.delete(id);
          }
          await database.deleteSession(id);
        }
      }
      await database.run("DELETE FROM dashboard_users WHERE username = ?", [username]);
      res.json({ success: true });
    } else if (action === 'pause') {
      const sessions = await database.getAllSessions();
      for (const id in sessions) {
        if (sessions[id].userId === username && activeSessions.has(id)) {
          const sock = activeSessions.get(id);
          sock.end();
          activeSessions.delete(id);
        }
      }
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/admin/bot/warn', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  const { sessionId, message } = req.body;
  
  try {
    const sessions = await database.getAllSessions();
    const session = sessions[sessionId];
    if (session && activeSessions.has(sessionId)) {
      const sock = activeSessions.get(sessionId);
      const targetNum = session.ownerNumber;
      const jid = targetNum.includes('@') ? targetNum : `${targetNum}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: `⚠️ *ADMIN WARNING*\n\n${message}` });
      res.json({ success: true });
    } else {
      res.status(404).send('Session not found or offline');
    }
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/admin/sessions', isAuthenticated, async (req, res) => {
  if (!req.session.isOwner) return res.status(403).send('Forbidden');
  try {
    const sessions = await database.getAllSessions();
    const result = Object.keys(sessions).map(id => ({
      id,
      ...sessions[id],
      status: activeSessions.has(id) ? 'Online' : 'Offline'
    }));
    res.json(result);
  } catch (e) {
    res.status(500).send(e.message);
  }
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


app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', err.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

} // end registerRoutes

process.on('SIGINT', () => {
  console.log('⚠️ Received SIGINT, shutting down gracefully...');
  server.close(() => process.exit(0));
});

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

function initSessions() {
  initAllSessions();
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function safeEndSocket() {
  try { if (sock) sock.end?.(); } catch (_) {} finally { sock = null; }
}
