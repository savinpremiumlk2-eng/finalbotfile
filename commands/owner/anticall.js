/**
 * AntiCall Command - Owner Only
 * -----------------------------
 * Path: commands/owner/anticall.js
 * Usage: .anticall on/off/status
 * Function: Auto-reject + auto-block incoming calls
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const ANTICALL_PATH = path.join(DATA_DIR, 'anticall.json');

// In-memory cache
let CACHE = { enabled: false, loadedAt: 0 };
const CACHE_TTL_MS = 10000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function safeJsonParse(text, fallback = {}) {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function readState(force = false) {
  try {
    const now = Date.now();
    if (!force && now - CACHE.loadedAt < CACHE_TTL_MS) return { ...CACHE };

    ensureDataDir();
    let enabled = false;
    if (fs.existsSync(ANTICALL_PATH)) {
      const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
      const data = safeJsonParse(raw, {});
      enabled = !!data.enabled;
    }
    CACHE = { enabled, loadedAt: now };
    return { enabled };
  } catch {
    return { enabled: !!CACHE.enabled };
  }
}

async function writeState(enabled) {
  try {
    ensureDataDir();
    fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    CACHE = { enabled: !!enabled, loadedAt: Date.now() };
    return true;
  } catch (e) {
    console.error('Error writing anticall state:', e);
    return false;
  }
}

function parseToggle(input = '') {
  const s = String(input).trim().toLowerCase();
  if (!s) return { type: 'help' };
  if (['status', 'st'].includes(s)) return { type: 'status' };
  if (['on', 'enable', 'enabled', '1', 'true', 'yes', 'y'].includes(s)) return { type: 'set', value: true };
  if (['off', 'disable', 'disabled', '0', 'false', 'no', 'n'].includes(s)) return { type: 'set', value: false };
  return { type: 'help' };
}

// Call handler
async function onCall(sock, callUpdate) {
  try {
    let enabled = false;
    
    // Check if it's a dashboard session with specific settings
    if (sock._customConfig && sock._customConfig.settings) {
      enabled = !!sock._customConfig.settings.anticall;
    } else {
      const state = await readState();
      enabled = state.enabled;
    }

    if (!enabled) return;

    const from = callUpdate?.from || callUpdate?.chatId || callUpdate?.callerId;
    const status = callUpdate?.status;
    const isIncoming = status === 'offer' || status === 'ringing' || !!from;

    if (!isIncoming || !from) return;

    // Reject call
    try {
      if (typeof sock.rejectCall === 'function') {
        await sock.rejectCall(callUpdate.id || callUpdate.callId, from);
      }
    } catch {}

    // Block caller
    try {
      if (typeof sock.updateBlockStatus === 'function') {
        await sock.updateBlockStatus(from, 'block');
      }
    } catch {}
  } catch (e) {
    console.error('AntiCall onCall error:', e);
  }
}

module.exports = {
  name: 'anticall',
  aliases: ['acall', 'callblock'],
  category: 'owner',
  description: 'Enable/disable auto-reject + auto-block incoming calls',
  usage: '.anticall <on|off|status>',
  ownerOnly: true,

  async execute(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const subRaw = args.join(' ').trim();
    const parsed = parseToggle(subRaw);
    const state = await readState(true);

    if (parsed.type === 'help') {
      return await sock.sendMessage(chatId, {
        text: `*📵 ANTICALL SETTINGS*\n\n` +
              'Usage: `.anticall on/off/status`\n' +
              `Current: ${state.enabled ? '✅ ENABLED' : '❌ DISABLED'}`
      }, { quoted: message });
    }

    if (parsed.type === 'status') {
      return await sock.sendMessage(chatId, {
        text: `📵 *Anticall Status*\nCurrent: ${state.enabled ? '✅ ENABLED' : '❌ DISABLED'}`
      }, { quoted: message });
    }

    const ok = await writeState(parsed.value);
    const newState = await readState(true);
    return await sock.sendMessage(chatId, {
      text: `📵 Anticall ${newState.enabled ? 'ENABLED' : 'DISABLED'}${ok ? '' : ' ⚠️ Failed to save'}`
    }, { quoted: message });
  },

  // Export for main bot to use in sock.ev.on('call', ...)
  readState,
  writeState,
  onCall
};
