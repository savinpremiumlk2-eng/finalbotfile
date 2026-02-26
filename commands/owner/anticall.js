/**
 * Infinity MD - AntiCall Plugin
 * Fully Fixed Version
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_PATH, 'anticall.json');

// Ensure data folder exists
function ensureDataFolder() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
}

// Read state
function getState() {
  try {
    ensureDataFolder();
    if (!fs.existsSync(FILE_PATH)) return false;
    const data = JSON.parse(fs.readFileSync(FILE_PATH));
    return !!data.enabled;
  } catch {
    return false;
  }
}

// Save state
function setState(value) {
  try {
    ensureDataFolder();
    fs.writeFileSync(FILE_PATH, JSON.stringify({ enabled: !!value }, null, 2));
    return true;
  } catch (e) {
    console.error('Anticall save error:', e);
    return false;
  }
}

// Parse user input
function parseInput(input = '') {
  const s = input.toLowerCase().trim();
  if (['on', 'enable', '1', 'true', 'yes'].includes(s)) return true;
  if (['off', 'disable', '0', 'false', 'no'].includes(s)) return false;
  if (['status'].includes(s)) return 'status';
  return null;
}

module.exports = {
  name: 'anticall',
  aliases: ['acall', 'callblock'],
  category: 'owner',
  description: 'Auto reject & block WhatsApp calls',
  usage: '.anticall on/off/status',
  ownerOnly: true,

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    const input = args[0];

    if (!input) {
      return await sock.sendMessage(chatId, {
        text:
          `📵 *ANTICALL SETTINGS*\n\n` +
          `Usage:\n` +
          `.anticall on\n` +
          `.anticall off\n` +
          `.anticall status`
      }, { quoted: msg });
    }

    const parsed = parseInput(input);

    if (parsed === 'status') {
      const enabled = getState();
      return await sock.sendMessage(chatId, {
        text:
          `📵 *Anticall Status*\n\n` +
          `Current: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`
      }, { quoted: msg });
    }

    if (parsed === null) {
      return await sock.sendMessage(chatId, {
        text: '❌ Invalid option. Use on/off/status.'
      }, { quoted: msg });
    }

    const saved = setState(parsed);

    return await sock.sendMessage(chatId, {
      text:
        `📵 *Anticall ${parsed ? 'ENABLED' : 'DISABLED'}*\n\n` +
        (saved
          ? parsed
            ? '✅ Incoming calls will now be rejected & blocked.'
            : '❌ Incoming calls are now allowed.'
          : '⚠️ Failed to save setting.')
    }, { quoted: msg });
  },

  // ==============================
  // 🔥 THIS IS THE IMPORTANT PART
  // ==============================
  async onCall(sock, call) {
    try {
      const enabled = getState();
      if (!enabled) return;

      const callerId = call.from || call.chatId || call.callerId;
      const callId = call.id || call.callId;

      if (!callerId) return;

      console.log('📵 Blocking call from:', callerId);

      // Reject call
      if (typeof sock.rejectCall === 'function') {
        try {
          await sock.rejectCall(callId, callerId);
        } catch {}
      }

      // Block user
      if (typeof sock.updateBlockStatus === 'function') {
        try {
          await sock.updateBlockStatus(callerId, 'block');
        } catch {}
      }

    } catch (err) {
      console.error('Anticall onCall error:', err);
    }
  }
};
