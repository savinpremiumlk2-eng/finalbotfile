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

function mentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function mono(txt) {
  return '```' + '\n' + txt + '\n' + '```';
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

module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'ownermenu', 'adminmenu', 'dlmenu', 'funmenu', 'aimenu',
    'entertainmentmenu', 'textmenu', 'toolmenu', 'moviemenu', 'generalmenu',
    // back-compat
    'animemenu', 'toolsmenu'
  ],
  category: 'general',
  description: 'Show menu + submenus',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';
    const botName = String(config.botName || 'INFINITY MD');

    // Load commands grouped by category
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

    const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const owner = ownerNames?.[0] || 'Infinity Team';
    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const who = mentionTag(sender);

    // detect submenu from ".menu admin" OR ".adminmenu"
    const usedCommand = String(extra?.commandName || '').toLowerCase();
    const subMenu =
      (args[0] && String(args[0]).toLowerCase()) ||
      (usedCommand.endsWith('menu') ? usedCommand : null);

    // ------- MAIN MENU -------
    if (!subMenu || subMenu === 'menu') {
      const menuTextRaw =
`╔══════════════════════╗
║  🤖 ${botName.toUpperCase()}
╠══════════════════════╣
║ 👋 User    : ${who}
║ 👑 Owner   : ${owner}
║ ⚡ Prefix  : ${prefix}
║ 📦 Cmds    : ${seen.size}
║ ⏱ Uptime  : ${uptime}
║ 🧠 RAM     : ${ram} MB
╚══════════════════════╝

╭─────── MENU LIST ───────╮
│ 🧭 ${prefix}generalmenu
│ 🤖 ${prefix}aimenu
│ 🛡️ ${prefix}adminmenu
│ 👑 ${prefix}ownermenu
│ 🎞️ ${prefix}dlmenu
│ 🎭 ${prefix}funmenu
│ 🔧 ${prefix}toolmenu
│ 👾 ${prefix}entertainmentmenu
│ 🖋 ${prefix}textmenu
│ 🎬 ${prefix}moviemenu
╰─────────────────────────╯

📜 Full Commands: ${prefix}mainmenu`;

      const caption = mono(menuTextRaw);

      const imgPath = pickMenuImage();
      if (imgPath) {
        const imageBuffer = fs.readFileSync(imgPath);
        return sock.sendMessage(
          chatId,
          {
            image: imageBuffer,
            caption,
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

      return sock.sendMessage(
        chatId,
        {
          text: caption,
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

    // ------- SUBMENUS -------
    let category = '';
    let title = '';

    switch (subMenu) {
      case 'generalmenu':       category = 'general';       title = '🧭 GENERAL COMMANDS'; break;
      case 'aimenu':            category = 'ai';            title = '🤖 AI COMMANDS'; break;
      case 'adminmenu':         category = 'admin';         title = '🛡️ ADMIN COMMANDS'; break;
      case 'ownermenu':         category = 'owner';         title = '👑 OWNER COMMANDS'; break;
      case 'dlmenu':            category = 'media';         title = '🎞️ MEDIA COMMANDS'; break;
      case 'funmenu':           category = 'fun';           title = '🎭 FUN COMMANDS'; break;
      case 'toolmenu':          category = 'utility';       title = '🔧 UTILITY COMMANDS'; break;
      case 'entertainmentmenu': category = 'entertainment'; title = '👾 ENTERTAINMENT COMMANDS'; break;
      case 'textmenu':          category = 'textmaker';     title = '🖋️ TEXTMAKER COMMANDS'; break;
      case 'moviemenu':         category = 'movies';        title = '🎬 MOVIES COMMANDS'; break;

      // allow ".menu admin" style
      case 'general':           category = 'general';       title = '🧭 GENERAL COMMANDS'; break;
      case 'ai':                category = 'ai';            title = '🤖 AI COMMANDS'; break;
      case 'admin':             category = 'admin';         title = '🛡️ ADMIN COMMANDS'; break;
      case 'owner':             category = 'owner';         title = '👑 OWNER COMMANDS'; break;
      case 'media':             category = 'media';         title = '🎞️ MEDIA COMMANDS'; break;
      case 'fun':               category = 'fun';           title = '🎭 FUN COMMANDS'; break;
      case 'utility':           category = 'utility';       title = '🔧 UTILITY COMMANDS'; break;
      case 'entertainment':     category = 'entertainment'; title = '👾 ENTERTAINMENT COMMANDS'; break;
      case 'textmaker':         category = 'textmaker';     title = '🖋️ TEXTMAKER COMMANDS'; break;
      case 'movies':            category = 'movies';        title = '🎬 MOVIES COMMANDS'; break;

      // back-compat
      case 'animemenu':         category = 'entertainment'; title = '👾 ENTERTAINMENT COMMANDS'; break;
      case 'toolsmenu':         category = 'utility';       title = '🔧 UTILITY COMMANDS'; break;

      default:
        return sock.sendMessage(chatId, { text: '❌ Invalid menu category!' }, { quoted: msg });
    }

    const list = categories[category] || [];
    if (!list.length) {
      return sock.sendMessage(
        chatId,
        { text: `❌ No commands found in ${title}\nTip: Your plugins must use category: "${category}"` },
        { quoted: msg }
      );
    }

    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    let body = '';
    for (const cmd of list) body += `│ ➜ ${prefix}${cmd.name}\n`;

    const submenuText =
`${title}
┌────────────────────────────────────────┐
│ Total: ${list.length}
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
${body.trimEnd()}
└────────────────────────────────────────┘
Back → ${prefix}menu   |   Full → ${prefix}mainmenu`;

    return sock.sendMessage(
      chatId,
      { text: mono(submenuText), mentions: [sender] },
      { quoted: msg }
    );
  }
};
