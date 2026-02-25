// 👇 ADD THIS AT THE VERY TOP
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Infinity MD running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Web server listening on", PORT));


// 👇 YOUR EXISTING BOT CODE BELOW
require("./config");
require("./settings");

const { default: makeWASocket } = require("@whiskeysockets/baileys");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    PHONENUMBER_MCC
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

async function startBot() {
    const sessionFolder = `./${config.sessionName}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ['Infinity MD', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
    });

    // Handle pairing code if sessionID is not provided and QR is preferred
    // If sessionID is provided in KnightBot! format, it should be handled in a separate script or here
    // However, the user asked to run using session id in config file
    if (config.sessionID && config.sessionID.startsWith('KnightBot!')) {
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

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 0;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
            
            console.log(`Connection closed: ${lastDisconnect?.error?.message || 'Unknown'}. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ Infinity MD connected successfully!');
            console.log(`📱 Bot Number: ${sock.user.id.split(':')[0]}`);
            console.log(`🤖 Bot Name: ${config.botName}`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message) continue;
            await handler.handleMessage(sock, msg).catch(err => console.error('Handler Error:', err));
        }
    });

    return sock;
}

startBot().catch(err => console.error('Start Error:', err));
