/**
 * Infinity MD - Render Web Service Stable Entry
 * Fixes:
 *  - Opens an HTTP port so Render Web Service won't restart the process
 *  - Removes duplicate Baileys imports
 *  - Ensures only ONE active socket (prevents Stream Errored (conflict))
 *  - Safer reconnect logic with backoff + cleanup
 *  - Removes deprecated printQRInTerminal option (optional)
 */

// ✅ Minimal web server (required for Render Web Service)
const express = require('express');
const app = express();
app.get('/', (req, res) => res.status(200).send('Infinity MD running ✅'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Web server listening on', PORT));

// ✅ Load config/settings first
require('./config');
require('./settings');

// ✅ Single Baileys import (NO duplicates)
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const handler = require('./handler');
const { initializeTempSystem } = require('./utils/tempManager');
const { startCleanup } = require('./utils/cleanup');

// Initialize system
initializeTempSystem();
startCleanup();

const logger = pino({ level: 'silent' });

// ✅ Keep ONE socket + timers globally to avoid conflicts
let sock = null;
let reconnectTimer = null;
let isConnecting = false;

// Simple reconnect backoff (5s -> 10s -> 20s max 60s)
let backoffMs = 5000;
const BACKOFF_MAX = 60000;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reasonMsg = '') {
  clearReconnectTimer();

  // If we're already connecting, don't schedule another
  if (isConnecting) return;

  const wait = backoffMs;
  backoffMs = Math.min(Math.round(backoffMs * 2), BACKOFF_MAX);

  console.log(`🔁 Reconnecting in ${Math.round(wait / 1000)}s... ${reasonMsg}`);

  reconnectTimer = setTimeout(() => {
    startBot().catch((e) => console.error('Start Error:', e));
  }, wait);
}

function resetBackoff() {
  backoffMs = 5000;
}

function safeEndSocket() {
  try {
    if (sock) {
      // Baileys exposes end() on the socket
      sock.end?.();
    }
  } catch (_) {
    // ignore
  } finally {
    sock = null;
  }
}

function ensureSessionFromConfig(sessionFolder) {
  // If you use a compressed session string like KnightBot!<base64>
  // write creds.json BEFORE you create the socket.
  if (config.sessionID && typeof config.sessionID === 'string' && config.sessionID.startsWith('KnightBot!')) {
    const zlib = require('zlib');
    try {
      const b64data = config.sessionID.split('!')[1];
      const decoded = zlib.gunzipSync(Buffer.from(b64data, 'base64'));
      if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });
      fs.writeFileSync(path.join(sessionFolder, 'creds.json'), decoded);
      console.log('📡 Session: Loaded from config sessionID');
    } catch (e) {
      console.error('❌ Failed to load sessionID:', e.message);
    }
  }
}

async function startBot() {
  // Prevent parallel start attempts
  if (isConnecting) return sock;
  isConnecting = true;
  clearReconnectTimer();

  try {
    const sessionFolder = `./${config.sessionName}`;

    // ✅ Write creds.json from config.sessionID BEFORE Baileys loads auth
    ensureSessionFromConfig(sessionFolder);

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    // ✅ Close any previous socket before creating a new one
    safeEndSocket();

    sock = makeWASocket({
      version,
      logger,

      // ⚠️ Deprecated option removed. If you still want terminal QR, handle `qr` in connection.update.
      // printQRInTerminal: true,

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
      const { connection, lastDisconnect, qr } = update;

      // If you want QR logs for local testing only:
      if (qr) {
        console.log('📷 QR received (handle/display it yourself)');
      }

      if (connection === 'open') {
        resetBackoff();
        console.log('\n✅ Infinity MD connected successfully!');
        try {
          console.log(`📱 Bot Number: ${sock.user?.id?.split(':')?.[0] || 'unknown'}`);
        } catch {
          console.log('📱 Bot Number: unknown');
        }
        console.log(`🤖 Bot Name: ${config.botName}`);
        return;
      }

      if (connection === 'close') {
        // Determine why we disconnected
        const statusCode = (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;

        const reasonMsg = lastDisconnect?.error?.message || 'Unknown';

        // Logged out means creds invalid; don't loop reconnect forever
        const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

        // Conflict means another client/session is connected; still can retry,
        // but best fix is: run bot in ONLY ONE place with ONE instance.
        const isConflict = /conflict/i.test(reasonMsg);

        console.log(`Connection closed: ${reasonMsg}`);

        // Always end current socket cleanly
        safeEndSocket();

        if (loggedOut) {
          console.log('❌ Logged out / 401. Delete session folder and relink once.');
          return;
        }

        // If conflict, you probably have another running instance.
        // We still retry with backoff, but you should stop other instances.
        if (isConflict) {
          scheduleReconnect('(conflict detected — stop other bot instances)');
        } else {
          scheduleReconnect();
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg?.message) continue;
        try {
          await handler.handleMessage(sock, msg);
        } catch (err) {
          console.error('Handler Error:', err);
        }
      }
    });

    return sock;
  } finally {
    isConnecting = false;
  }
}

// Start
startBot().catch((err) => console.error('Start Error:', err));
