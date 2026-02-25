/**
 * ✅ BEAUTIFUL .menu with 5 RANDOM DESIGNS (Infinity MD)
 * - Every time user types .menu it will randomly pick 1 of 5 designs
 * - Keeps banner image support (optional)
 * - Submenus (admin/owner/etc) still work
 *
 * Replace: commands/general/menu.js
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
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

function getMentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMenuLinks(prefix) {
  return {
    general: `${prefix}generalmenu`,
    ai: `${prefix}aimenu`,
    admin: `${prefix}adminmenu`,
    owner: `${prefix}ownermenu`,
    media: `${prefix}dlmenu`,
    fun: `${prefix}funmenu`,
    utility: `${prefix}toolmenu`,
    entertainment: `${prefix}entertainmentmenu`,
    textmaker: `${prefix}textmenu`,
    movies: `${prefix}moviemenu`,
    full: `${prefix}mainmenu`
  };
}

/** 5 MAIN MENU DESIGNS */
function renderMainMenuDesign(designId, ctx) {
  const {
    botName, owner, prefix, total, uptime, ram, who, links
  } = ctx;

  switch (designId) {
    // ✅ DESIGN 1 (Clean card + arrows)
    case 1:
      return (
`✨ *${botName}* ✨

╭───────────────╮
│ 👋 Hello *${who}*
│ ⚡ Prefix  : *${prefix}*
│ 📦 Commands: *${total}*
│ 👑 Owner   : *${owner}*
│ ⏱ Uptime  : *${uptime}*
│ 🧠 RAM     : *${ram} MB*
╰───────────────╯

📚 *MENUS*
╭────────────────────────╮
│ 🧭 General        → ${links.general}
│ 🤖 AI             → ${links.ai}
│ 🛡️ Admin          → ${links.admin}
│ 👑 Owner          → ${links.owner}
│ 🎞️ Media          → ${links.media}
│ 🎭 Fun            → ${links.fun}
│ 🔧 Utility        → ${links.utility}
│ 👾 Entertainment  → ${links.entertainment}
│ 🖋 TextMaker      → ${links.textmaker}
│ 🎬 Movies         → ${links.movies}
╰────────────────────────╯

🗂 Full list: *${links.full}*
💡 Example: *${prefix}menu admin*`
      );

    // ✅ DESIGN 2 (Neon / cyber)
    case 2:
      return (
`⚡🟣 *${botName} CONTROL PANEL* 🟣⚡
┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 👤 User     : *${who}*
┃ 👑 Owner    : *${owner}*
┃ ⚡ Prefix   : *${prefix}*
┃ 📦 Commands : *${total}*
┃ ⏱ Uptime   : *${uptime}*
┃ 🧠 RAM      : *${ram} MB*
┗━━━━━━━━━━━━━━━━━━━━━━┛

🔰 *NAVIGATION*
[1] 🧭 General        : ${links.general}
[2] 🤖 AI             : ${links.ai}
[3] 🛡️ Admin          : ${links.admin}
[4] 👑 Owner          : ${links.owner}
[5] 🎞️ Media          : ${links.media}
[6] 🎭 Fun            : ${links.fun}
[7] 🔧 Utility        : ${links.utility}
[8] 👾 Entertainment  : ${links.entertainment}
[9] 🖋 TextMaker      : ${links.textmaker}
[10] 🎬 Movies        : ${links.movies}

📜 *FULL COMMAND LIST* → ${links.full}`
      );

    // ✅ DESIGN 3 (Minimal + tidy columns feel)
    case 3:
      return (
`*${botName}*
Hello *${who}* 👋

• Prefix: *${prefix}*   • Commands: *${total}*
• Owner : *${owner}*   • Uptime  : *${uptime}*

╭──────── MENUS ────────╮
│ ${links.general}   | 🧭 General
│ ${links.ai}        | 🤖 AI
│ ${links.admin}     | 🛡️ Admin
│ ${links.owner}     | 👑 Owner
│ ${links.media}     | 🎞️ Media
│ ${links.fun}       | 🎭 Fun
│ ${links.utility}   | 🔧 Utility
│ ${links.entertainment} | 👾 Entertainment
│ ${links.textmaker} | 🖋 TextMaker
│ ${links.movies}    | 🎬 Movies
╰───────────────────────╯

📜 Full: *${links.full}*`
      );

    // ✅ DESIGN 4 (Fancy box + icons)
    case 4:
      return (
`╔══════════════════════╗
║  🤖 ${botName.toUpperCase()}
╠══════════════════════╣
║ 👋 User    : ${who}
║ 👑 Owner   : ${owner}
║ ⚡ Prefix  : ${prefix}
║ 📦 Cmds    : ${total}
║ ⏱ Uptime  : ${uptime}
║ 🧠 RAM     : ${ram} MB
╚══════════════════════╝

╭─────── MENU LIST ───────╮
│ 🧭 ${links.general}
│ 🤖 ${links.ai}
│ 🛡️ ${links.admin}
│ 👑 ${links.owner}
│ 🎞️ ${links.media}
│ 🎭 ${links.fun}
│ 🔧 ${links.utility}
│ 👾 ${links.entertainment}
│ 🖋 ${links.textmaker}
│ 🎬 ${links.movies}
╰─────────────────────────╯

📜 Full Commands: *${links.full}*
💡 Try: *${prefix}menu fun*`
      );

    // ✅ DESIGN 5 (Compact “quick buttons” style)
    default:
      return (
`🌀 *${botName} MENU*
Hi *${who}* 👋  |  Prefix: *${prefix}*  |  Cmds: *${total}*

⏱ ${uptime}   🧠 ${ram}MB   👑 ${owner}

╭──── QUICK MENUS ────╮
│ [🧭] ${links.general}
│ [🤖] ${links.ai}
│ [🛡️] ${links.admin}
│ [👑] ${links.owner}
│ [🎞️] ${links.media}
│ [🎭] ${links.fun}
│ [🔧] ${links.utility}
│ [👾] ${links.entertainment}
│ [🖋] ${links.textmaker}
│ [🎬] ${links.movies}
╰─────────────────────╯

📜 Full list: *${links.full}*`
      );
  }
}

module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'ownermenu', 'adminmenu', 'dlmenu', 'funmenu', 'aimenu',
    'entertainmentmenu', 'textmenu', 'toolmenu', 'moviemenu', 'generalmenu',
    // backward compatibility
    'animemenu', 'toolsmenu'
  ],
  category: 'general',
  description: 'Show menus and sub menus',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {
    const reply = extra?.reply
      ? extra.reply.bind(extra)
      : async (text) => {
          const jid = extra?.from || msg?.key?.remoteJid;
          return sock.sendMessage(jid, { text }, { quoted: msg });
        };

    try {
      const prefix = config.prefix || '.';
      const botName = String(config.botName || 'Infinity MD');
      const chatId = extra?.from || msg?.key?.remoteJid;
      const sender = extra?.sender || msg?.key?.participant || chatId;

      // Load commands and group by category
      const commands = loadCommands();
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

      // Stats
      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
      const owner = ownerNames?.[0] || 'Infinity Team';
      const uptime = formatUptime(process.uptime());
      const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      const total = seen.size;

      // Detect submenu
      const usedCommand = String(extra?.commandName || '').toLowerCase();
      const subMenu =
        (args[0] && String(args[0]).toLowerCase()) ||
        (usedCommand.endsWith('menu') ? usedCommand : null);

      // ✅ MAIN MENU (random design)
      if (!subMenu || subMenu === 'menu') {
        const who = getMentionTag(sender);
        const links = buildMenuLinks(prefix);

        const designId = randPick([1, 2, 3, 4, 5]);
        const menuText = renderMainMenuDesign(designId, {
          botName, owner, prefix, total, uptime, ram, who, links
        });

        // Send with image if exists (optional)
        const imgPath = pickMenuImage();
        if (imgPath) {
          const imageBuffer = fs.readFileSync(imgPath);
          return sock.sendMessage(
            chatId,
            {
              image: imageBuffer,
              caption: menuText,
              mentions: sender ? [sender] : [],
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

        return sock.sendMessage(
          chatId,
          { text: menuText, mentions: sender ? [sender] : [] },
          { quoted: msg }
        );
      }

      // ✅ SUBMENU mapping (your corrected categories)
      let category = '';
      let title = '';

      switch (subMenu) {
        case 'generalmenu':         category = 'general';       title = '🧭 GENERAL COMMANDS'; break;
        case 'aimenu':              category = 'ai';            title = '🤖 AI COMMANDS'; break;
        case 'adminmenu':           category = 'admin';         title = '🛡️ ADMIN COMMANDS'; break;
        case 'ownermenu':           category = 'owner';         title = '👑 OWNER COMMANDS'; break;
        case 'dlmenu':              category = 'media';         title = '🎞️ MEDIA COMMANDS'; break;
        case 'funmenu':             category = 'fun';           title = '🎭 FUN COMMANDS'; break;
        case 'toolmenu':            category = 'utility';       title = '🔧 UTILITY COMMANDS'; break;
        case 'entertainmentmenu':   category = 'entertainment'; title = '👾 ENTERTAINMENT COMMANDS'; break;
        case 'textmenu':            category = 'textmaker';     title = '🖋️ TEXTMAKER COMMANDS'; break;
        case 'moviemenu':           category = 'movies';        title = '🎬 MOVIES COMMANDS'; break;

        // allow ".menu admin" style
        case 'general':             category = 'general';       title = '🧭 GENERAL COMMANDS'; break;
        case 'ai':                  category = 'ai';            title = '🤖 AI COMMANDS'; break;
        case 'admin':               category = 'admin';         title = '🛡️ ADMIN COMMANDS'; break;
        case 'owner':               category = 'owner';         title = '👑 OWNER COMMANDS'; break;
        case 'media':               category = 'media';         title = '🎞️ MEDIA COMMANDS'; break;
        case 'fun':                 category = 'fun';           title = '🎭 FUN COMMANDS'; break;
        case 'utility':             category = 'utility';       title = '🔧 UTILITY COMMANDS'; break;
        case 'entertainment':       category = 'entertainment'; title = '👾 ENTERTAINMENT COMMANDS'; break;
        case 'textmaker':           category = 'textmaker';     title = '🖋️ TEXTMAKER COMMANDS'; break;
        case 'movies':              category = 'movies';        title = '🎬 MOVIES COMMANDS'; break;

        // backward compatibility
        case 'animemenu':           category = 'entertainment'; title = '👾 ENTERTAINMENT COMMANDS'; break;
        case 'toolsmenu':           category = 'utility';       title = '🔧 UTILITY COMMANDS'; break;

        default:
          return reply('❌ Invalid menu category!');
      }

      const list = categories[category];
      if (!list || !list.length) {
        return reply(
          `❌ No commands found in *${title}*\n\n` +
          `✅ Make sure plugins use: category: "${category}"`
        );
      }

      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

      // ✅ Nice submenu style (clean)
      let body = '';
      for (const cmd of list) body += `│ ➜ ${prefix}${cmd.name}\n`;

      const text =
`✨ *${botName}* ✨
╭────────────────────────╮
│ ${title}
│ 📌 Total: *${list.length}*
╰────────────────────────╯
╭────────────────────────╮
${body.trimEnd()}
╰────────────────────────╯

💡 Back: *${prefix}menu*   |   📜 Full: *${prefix}mainmenu*`;

      return sock.sendMessage(
        chatId,
        { text, mentions: sender ? [sender] : [] },
        { quoted: msg }
      );

    } catch (error) {
      return reply(`❌ Error: ${error.message}`);
    }
  }
};
