/**
 * Anti-Call Command - Enable/disable anti-call system (persistent)
 * Usage:
 *  .anticall            -> show status
 *  .anticall on         -> enable globally
 *  .anticall off        -> disable globally
 *  .anticall toggle     -> toggle globally
 *  .anticall on group   -> enable for this group only
 *  .anticall off group  -> disable for this group only
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'anticall.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadDB() {
  try {
    ensureDir(DATA_DIR);
    if (!fs.existsSync(DB_PATH)) {
      const initial = { global: { enabled: false }, perChat: {} };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { global: { enabled: false }, perChat: {} };
  }
}

function saveDB(db) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getChatId(msg, extra) {
  return extra?.chatId || msg?.key?.remoteJid;
}

module.exports = {
  name: 'anticall',
  category: 'owner',
  ownerOnly: true,
  description: 'Enable/disable anti-call system (persistent)',
  usage: '.anticall [on|off|toggle] [global|group]',

  async execute(sock, msg, args, extra) {
    const chatId = getChatId(msg, extra);
    const isGroup = !!chatId && chatId.endsWith('@g.us');

    const db = loadDB();

    // No args -> show status
    if (!args[0]) {
      const globalEnabled = !!db.global?.enabled;
      const chatEnabled = db.perChat?.[chatId]?.enabled;

      let scopeLine = '';
      if (isGroup) {
        scopeLine = `\nThis group override: ${
          typeof chatEnabled === 'boolean' ? (chatEnabled ? 'ON ✅' : 'OFF ❌') : 'Not set (uses global)'
        }`;
      }

      return extra.reply(
        `📵 *Anti-call status*\nGlobal: ${globalEnabled ? 'ON ✅' : 'OFF ❌'}${scopeLine}\n\n` +
        `Use:\n` +
        `• .anticall on/off/toggle\n` +
        (isGroup ? `• .anticall on/off group\n` : '')
      );
    }

    const action = String(args[0]).toLowerCase();
    if (!['on', 'off', 'toggle'].includes(action)) {
      return extra.reply('Usage: .anticall [on|off|toggle] [global|group]');
    }

    const scope = String(args[1] || 'global').toLowerCase();

    // group scope only valid in groups
    if (scope === 'group' && !isGroup) {
      return extra.reply('❌ This option works only in groups. Use `.anticall on/off` for global.');
    }

    // Decide new value
    const currentGlobal = !!db.global?.enabled;
    const currentGroup = typeof db.perChat?.[chatId]?.enabled === 'boolean'
      ? db.perChat[chatId].enabled
      : undefined;

    const resolveNewValue = (current) => {
      if (action === 'toggle') return !current;
      return action === 'on';
    };

    if (scope === 'group') {
      const base = typeof currentGroup === 'boolean' ? currentGroup : currentGlobal;
      const next = resolveNewValue(base);

      db.perChat = db.perChat || {};
      db.perChat[chatId] = { enabled: next, updatedAt: Date.now() };
      saveDB(db);

      return extra.reply(
        next
          ? '✅ Anti-call enabled for *this group*.'
          : '❌ Anti-call disabled for *this group*.'
      );
    }

    // global
    const next = resolveNewValue(currentGlobal);
    db.global = { enabled: next, updatedAt: Date.now() };
    saveDB(db);

    return extra.reply(
      next
        ? '✅ Anti-call enabled (global). Calls will be auto-rejected.'
        : '❌ Anti-call disabled (global).'
    );
  }
};
