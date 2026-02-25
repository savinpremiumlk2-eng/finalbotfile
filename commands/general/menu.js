/**
 * Infinity MD - Menu System (FINAL)
 * File: commands/general/menu.js
 *
 * ✅ Main menu: banner + forwarded style + boxes + emojis (mobile friendly)
 * ✅ Submenus: SAME style as .menu (not garbage) + paginated + numbered
 * ✅ Number reply: works for main menu + submenu command list
 *
 * ⚠️ REQUIRED: paste the small handler snippet (at bottom) into messages.upsert
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');

// -------------------- Number reply session (in-memory) --------------------
const MENU_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MENU_SESSIONS = new Map();   // key -> { expiresAt, map }

function skey(chatId, sender) {
  return `${chatId}:${sender}`;
}

function setSession(chatId, sender, map) {
  MENU_SESSIONS.set(skey(chatId, sender), { expiresAt: Date.now() + MENU_TTL_MS, map });
}

function getSession(chatId, sender) {
  const s = MENU_SESSIONS.get(skey(chatId, sender));
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    MENU_SESSIONS.delete(skey(chatId, sender));
    return null;
  }
  return s;
}

function clearSession(chatId, sender) {
  MENU_SESSIONS.delete(skey(chatId, sender));
}

/**
 * Used by messages.upsert to resolve a numeric reply into a command string
 * returns: string | null
 */
function resolveNumberReply(chatId, sender, text) {
  const t = String(text || '').trim();
  if (!/^\d{1,2}$/.test(t)) return null;

  const s = getSession(chatId, sender);
  if (!s) return null;

  const cmd = s.map[t];
  if (!cmd) return null;

  // one-time use (prevents accidental repeats)
  clearSession(chatId, sender);
  return cmd;
}

// Expose to main handler
module.exports._menuReply = {
  resolveNumberReply,
};

// -------------------- Helpers --------------------
function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function mentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function pickMenuImage() {
  const bannersPath = path.join(__dirname, '../../utils/banners');
  let imagePath = path.join(__dirname, '../../utils/bot_image.jpg');

  try {
    if (fs.existsSync(bannersPath)) {
      const banners = fs.readdirSync(bannersPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
      if (banners.length) {
        imagePath = path.join(bannersPath, banners[Math.floor(Math.random() * banners.length)]);
      }
    }
  } catch (_) {}

  return fs.existsSync(imagePath) ? imagePath : null;
}

function buildCategoriesMap(commands) {
  const categories = {};
  const cmdList = Array.isArray(commands)
    ? commands
    : (commands instanceof Map ? Array.from(commands.values()) : []);

  const seen = new Set();
  for (const cmd of cmdList) {
    if (!cmd?.name) continue;
    if (seen.has(cmd.name)) continue;
    seen.add(cmd.name);

    const cat = String(cmd.category || 'other').toLowerCase().trim();
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd);
  }

  return { categories, total: seen.size };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// -------------------- Command --------------------
module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'ownermenu', 'adminmenu', 'dlmenu', 'funmenu', 'aimenu',
    'toolmenu', 'entertainmentmenu', 'textmenu', 'moviemenu', 'generalmenu',
    // back-compat
    'animemenu', 'toolsmenu'
  ],
  category: 'general',
  description: 'Show menu + submenus (Infinity MD)',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';
    const botName = String(config.botName || 'INFINITY MD');

    const commands = loadCommands();
    const { categories, total } = buildCategoriesMap(commands);

    const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const owner = ownerNames?.[0] || 'Infinity Team';

    const uptimeStr = formatUptime(process.uptime());
    const ramMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

    // detect submenu from ".menu admin" or alias ".adminmenu"
    const usedCommand = String(extra?.commandName || '').toLowerCase();
    const subMenu =
      (args[0] && String(args[0]).toLowerCase()) ||
      (usedCommand.endsWith('menu') ? usedCommand : null);

    // ---------------- MAIN MENU ----------------
    if (!subMenu || subMenu === 'menu') {
      const who = mentionTag(sender);

      // main menu number mapping
      const numberMap = {
        '1': `${prefix}ownermenu`,
        '2': `${prefix}adminmenu`,
        '3': `${prefix}dlmenu`,
        '4': `${prefix}funmenu`,
        '5': `${prefix}aimenu`,
        '6': `${prefix}toolmenu`,
        '7': `${prefix}entertainmentmenu`,
        '8': `${prefix}textmenu`,
        '9': `${prefix}moviemenu`,
        '10': `${prefix}generalmenu`,
        '0': `${prefix}mainmenu`
      };
      setSession(chatId, sender, numberMap);

      let menuText = `🤖 *MAIN MENU*\n`;
      menuText += `╭───〔 🤖 ${botName} 〕───\n`;
      menuText += `│ 👋 *User* : ${who}\n`;
      menuText += `│ 👤 *Owner* : ${owner}\n`;
      menuText += `│ 📊 *Commands* : ${total}\n`;
      menuText += `│ ⏱ *Uptime* : ${uptimeStr}\n`;
      menuText += `│ 🚀 *RAM* : ${ramMB}MB\n`;
      menuText += `│ ⌨️ *Prefix* : ${prefix}\n`;
      menuText += `╰────────────────────\n\n`;

      menuText += `╭───〔 📂 MAIN MENUS 〕───\n`;
      menuText += `│ 1️⃣ 👑 ${prefix}ownermenu\n`;
      menuText += `│ 2️⃣ 🛡️ ${prefix}adminmenu\n`;
      menuText += `│ 3️⃣ 📥 ${prefix}dlmenu\n`;
      menuText += `│ 4️⃣ 🎮 ${prefix}funmenu\n`;
      menuText += `│ 5️⃣ 🤖 ${prefix}aimenu\n`;
      menuText += `│ 6️⃣ 🛠 ${prefix}toolmenu\n`;
      menuText += `│ 7️⃣ 👾 ${prefix}entertainmentmenu\n`;
      menuText += `│ 8️⃣ ✍️ ${prefix}textmenu\n`;
      menuText += `│ 9️⃣ 🎬 ${prefix}moviemenu\n`;
      menuText += `│ 🔟 🧭 ${prefix}generalmenu\n`;
      menuText += `│ 0️⃣ 📜 ${prefix}mainmenu\n`;
      menuText += `╰────────────────────\n\n`;

      menuText += `💡 *Reply with a number* (1-10 / 0)\n`;
      menuText += `╭───〔 🌟 CREDITS 〕───\n`;
      menuText += `│ ⚡ *Infinity MD* by Infinity Team\n`;
      menuText += `│ 🧠 Powered by Baileys\n`;
      menuText += `╰────────────────────`;

      // banner + forwarded style
      const imgPath = pickMenuImage();
      if (imgPath) {
        const imageBuffer = fs.readFileSync(imgPath);
        return sock.sendMessage(
          chatId,
          {
            image: imageBuffer,
            caption: menuText,
            mentions: [sender],
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: config.newsletterJid || '120363161513685998@newsletter',
                newsletterName: config.botName || 'INFINITY MD',
                serverMessageId: -1
              }
            }
          },
          { quoted: msg }
        );
      }

      return sock.sendMessage(chatId, { text: menuText, mentions: [sender] }, { quoted: msg });
    }

    // ---------------- SUBMENUS (SAME STYLE AS .menu) ----------------
    let category = '';
    let title = '';

    switch (subMenu) {
      case 'ownermenu':           category = 'owner';         title = '👑 OWNER MENU'; break;
      case 'adminmenu':           category = 'admin';         title = '🛡️ ADMIN MENU'; break;
      case 'dlmenu':              category = 'media';         title = '📥 MEDIA MENU'; break;
      case 'funmenu':             category = 'fun';           title = '🎮 FUN MENU'; break;
      case 'aimenu':              category = 'ai';            title = '🤖 AI MENU'; break;
      case 'toolmenu':            category = 'utility';       title = '🛠 TOOLS MENU'; break;
      case 'entertainmentmenu':   category = 'entertainment'; title = '👾 ENTERTAINMENT MENU'; break;
      case 'textmenu':            category = 'textmaker';     title = '✍️ TEXT MENU'; break;
      case 'moviemenu':           category = 'movies';        title = '🎬 MOVIE MENU'; break;
      case 'generalmenu':         category = 'general';       title = '🧭 GENERAL MENU'; break;

      // ".menu admin"
      case 'owner':               category = 'owner';         title = '👑 OWNER MENU'; break;
      case 'admin':               category = 'admin';         title = '🛡️ ADMIN MENU'; break;
      case 'media':               category = 'media';         title = '📥 MEDIA MENU'; break;
      case 'fun':                 category = 'fun';           title = '🎮 FUN MENU'; break;
      case 'ai':                  category = 'ai';            title = '🤖 AI MENU'; break;
      case 'utility':             category = 'utility';       title = '🛠 TOOLS MENU'; break;
      case 'entertainment':       category = 'entertainment'; title = '👾 ENTERTAINMENT MENU'; break;
      case 'textmaker':           category = 'textmaker';     title = '✍️ TEXT MENU'; break;
      case 'movies':              category = 'movies';        title = '🎬 MOVIE MENU'; break;
      case 'general':             category = 'general';       title = '🧭 GENERAL MENU'; break;

      // back-compat
      case 'animemenu':           category = 'entertainment'; title = '👾 ENTERTAINMENT MENU'; break;
      case 'toolsmenu':           category = 'utility';       title = '🛠 TOOLS MENU'; break;

      default:
        return sock.sendMessage(chatId, { text: '❌ Invalid menu category!' }, { quoted: msg });
    }

    const list = (categories[category] || []).map(x => x.name).filter(Boolean);
    if (!list.length) {
      return sock.sendMessage(
        chatId,
        { text: `❌ No commands found in ${title}\nTip: plugins must use category: "${category}"` },
        { quoted: msg }
      );
    }

    list.sort((a, b) => String(a).localeCompare(String(b)));

    // Page support: ".adminmenu 2" OR ".menu admin 2"
    const pageArg = Number(args?.[1] || args?.[0] || 1);
    const perPage = 20; // mobile friendly
    const pages = chunk(list, perPage);
    const totalPages = Math.max(1, pages.length);
    const page = Math.min(Math.max(1, pageArg), totalPages);
    const pageItems = pages[page - 1];

    // Build numbered list + number reply map (1..20, 0 back, 99 next page)
    const submenuMap = { '0': `${prefix}menu` };
    let lines = '';
    for (let i = 0; i < pageItems.length; i++) {
      const n = String(i + 1);
      const cmdName = pageItems[i];
      submenuMap[n] = `${prefix}${cmdName}`;
      // short line to fit mobile
      lines += `│ ${n.padStart(2, '0')} ➜ ${prefix}${cmdName}\n`;
    }
    // Optional next page shortcut
    if (page < totalPages) submenuMap['99'] = `${prefix}menu ${category} ${page + 1}`;
    setSession(chatId, sender, submenuMap);

    let submenuText = `${title}\n`;
    submenuText += `╭───〔 🤖 ${botName} 〕───\n`;
    submenuText += `│ 📦 *Total* : ${list.length}\n`;
    submenuText += `│ 📄 *Page* : ${page}/${totalPages}\n`;
    submenuText += `│ ⌨️ *Prefix* : ${prefix}\n`;
    submenuText += `╰────────────────────\n\n`;

    submenuText += `╭───〔 ✅ COMMANDS 〕───\n`;
    submenuText += lines;
    submenuText += `╰────────────────────\n\n`;

    submenuText += `💡 Reply *1-${pageItems.length}* to run a command\n`;
    submenuText += `💡 Reply *0* to go back`;
    if (page < totalPages) submenuText += `\n💡 Reply *99* for next page`;

    submenuText += `\n╭───〔 🌟 CREDITS 〕───\n`;
    submenuText += `│ ⚡ Infinity MD • Infinity Team\n`;
    submenuText += `╰────────────────────`;

    return sock.sendMessage(chatId, { text: submenuText, mentions: [sender] }, { quoted: msg });
  }
};
