/**
 * ✅ FULL MENU FILE (MOBILE FRIENDLY + BOXES + EMOJIS + NUMBER-REPLY SYSTEM + INFINITY MD CREDITS)
 * File: commands/general/menu.js
 *
 * Features:
 * - Banner image + forwarded newsletter style
 * - Modern mobile-friendly boxed design (your template)
 * - Submenus: .ownermenu .adminmenu .dlmenu .funmenu .aimenu .toolmenu .entertainmentmenu .textmenu .moviemenu .generalmenu
 * - Number reply system (1-10 / 0) stored in memory for 2 minutes
 * - Includes Infinity MD credits at bottom
 *
 * IMPORTANT:
 * - Number-reply needs ONE small snippet in your main messages.upsert handler.
 *   (I include the snippet at the bottom of this file.)
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');

// -------------------- Number-reply storage (in-memory) --------------------
const MENU_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MENU_SESSIONS = new Map();   // key => { expiresAt, map }

function sessionKey(chatId, sender) {
  return `${chatId}:${sender}`;
}

function setMenuSession(chatId, sender, map) {
  MENU_SESSIONS.set(sessionKey(chatId, sender), {
    expiresAt: Date.now() + MENU_TTL_MS,
    map
  });
}

function getMenuSession(chatId, sender) {
  const k = sessionKey(chatId, sender);
  const s = MENU_SESSIONS.get(k);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    MENU_SESSIONS.delete(k);
    return null;
  }
  return s;
}

function clearMenuSession(chatId, sender) {
  MENU_SESSIONS.delete(sessionKey(chatId, sender));
}

// Export helper so your main handler can use it
module.exports._menuReply = {
  getMenuSession,
  clearMenuSession
};

// -------------------- Helpers --------------------
function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function mono(txt) {
  // monospace makes lists align better on mobile
  return '```' + '\n' + txt + '\n' + '```';
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
        imagePath = path.join(bannersPath, banners[Math.random() * banners.length | 0]);
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

      // number-reply mapping
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

      setMenuSession(chatId, sender, numberMap);

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

      menuText += `💡 *Reply with a number* (1-10 / 0) to open.\n`;
      menuText += `╭───〔 🌟 CREDITS 〕───\n`;
      menuText += `│ ⚡ *Infinity MD* by Infinity Team\n`;
      menuText += `│ 🧠 Powered by Baileys\n`;
      menuText += `╰────────────────────`;

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

    // ---------------- SUBMENUS (MODERN + SMALL) ----------------
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

    const list = categories[category] || [];
    if (!list.length) {
      return sock.sendMessage(
        chatId,
        { text: `❌ No commands found in ${title}\nTip: plugins must use category: "${category}"` },
        { quoted: msg }
      );
    }

    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    // Mobile-friendly: 2 columns inside a small box
    const names = list.map(x => `${prefix}${x.name}`);
    const colW = 14;
    let lines = '';
    for (let i = 0; i < names.length; i += 2) {
      const a = (names[i] || '').padEnd(colW, ' ');
      const b = (names[i + 1] || '');
      lines += `│ ${a} ${b}\n`;
    }

    let submenuText = `${title}\n`;
    submenuText += `╭───〔 📋 COMMANDS 〕───\n`;
    submenuText += `│ 📦 Total : ${names.length}\n`;
    submenuText += `╰────────────────────\n`;
    submenuText += `╭───〔 ✅ LIST 〕───\n`;
    submenuText += lines;
    submenuText += `╰────────────────────\n\n`;
    submenuText += `⬅ Back: ${prefix}menu  |  📜 Full: ${prefix}mainmenu\n`;
    submenuText += `⚡ Infinity MD • Infinity Team`;

    return sock.sendMessage(
      chatId,
      { text: mono(submenuText), mentions: [sender] },
      { quoted: msg }
    );
  }
};

/**
 * ✅ REQUIRED NUMBER-REPLY HANDLER SNIPPET
 *
 * Paste this into your messages.upsert handler BEFORE normal command parsing:
 *
 *   const menuCmd = require('./commands/general/menu'); // adjust path if needed
 *   const chatId = m.key.remoteJid;
 *   const sender = m.key.participant || chatId;
 *   const text = extractedText; // your text extractor
 *
 *   const sess = menuCmd._menuReply.getMenuSession(chatId, sender);
 *   if (sess && /^\\d{1,2}$/.test(text.trim())) {
 *     const cmdText = sess.map[text.trim()];
 *     if (cmdText) {
 *       menuCmd._menuReply.clearMenuSession(chatId, sender);
 *       // Feed cmdText into your existing command handler/parser:
 *       // example: handleCommand(cmdText, m)
 *     }
 *   }
 *
 * If you paste your handler code, I will merge this perfectly for your bot base.
 */
