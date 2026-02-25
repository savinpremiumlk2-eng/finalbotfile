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

// Mobile-friendly 2-column list + pagination
function renderTwoCols(items, prefix, page = 1, perPage = 24) {
  const clean = items.map(x => `${prefix}${x}`);
  const totalPages = Math.max(1, Math.ceil(clean.length / perPage));
  const p = Math.min(Math.max(1, page), totalPages);

  const start = (p - 1) * perPage;
  const slice = clean.slice(start, start + perPage);

  const colW = 14; // keep small for mobile
  let out = '';

  for (let i = 0; i < slice.length; i += 2) {
    const a = (slice[i] || '').padEnd(colW, ' ');
    const b = (slice[i + 1] || '');
    out += `• ${a}  ${b}\n`;
  }

  return { out: out.trimEnd(), page: p, totalPages };
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
  description: 'Show menu + submenus (mobile friendly)',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';
    const botName = String(config.botName || 'Infinity MD');
    const botTitle = botName.toUpperCase();

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

    // Stats
    const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const owner = ownerNames?.[0] || 'Infinity Team';
    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const who = mentionTag(sender);

    // Detect submenu from ".menu admin" OR ".adminmenu"
    const usedCommand = String(extra?.commandName || '').toLowerCase();
    const subMenu =
      (args[0] && String(args[0]).toLowerCase()) ||
      (usedCommand.endsWith('menu') ? usedCommand : null);

    // ---------------- MAIN MENU (MOBILE FRIENDLY) ----------------
    if (!subMenu || subMenu === 'menu') {
      // keep each line short (fits mobile)
      const menuTextRaw =
`${botTitle}
Hi ${who}

⚡ ${prefix} | 📦 ${seen.size} cmds
⏱ ${uptime} | 🧠 ${ram}MB
👑 ${owner}

MENUS
1) ${prefix}generalmenu
2) ${prefix}aimenu
3) ${prefix}adminmenu
4) ${prefix}ownermenu
5) ${prefix}dlmenu
6) ${prefix}funmenu
7) ${prefix}toolmenu
8) ${prefix}entertainmentmenu
9) ${prefix}textmenu
10) ${prefix}moviemenu

📜 Full: ${prefix}mainmenu
Tip: ${prefix}menu admin 2`;

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

    // ---------------- SUBMENUS (MODERN + SMALL + PAGINATED) ----------------
    let category = '';
    let title = '';

    switch (subMenu) {
      case 'generalmenu':       category = 'general';       title = 'General'; break;
      case 'aimenu':            category = 'ai';            title = 'AI'; break;
      case 'adminmenu':         category = 'admin';         title = 'Admin'; break;
      case 'ownermenu':         category = 'owner';         title = 'Owner'; break;
      case 'dlmenu':            category = 'media';         title = 'Media'; break;
      case 'funmenu':           category = 'fun';           title = 'Fun'; break;
      case 'toolmenu':          category = 'utility';       title = 'Tools'; break;
      case 'entertainmentmenu': category = 'entertainment'; title = 'Entertainment'; break;
      case 'textmenu':          category = 'textmaker';     title = 'TextMaker'; break;
      case 'moviemenu':         category = 'movies';        title = 'Movies'; break;

      // ".menu admin" style
      case 'general':           category = 'general';       title = 'General'; break;
      case 'ai':                category = 'ai';            title = 'AI'; break;
      case 'admin':             category = 'admin';         title = 'Admin'; break;
      case 'owner':             category = 'owner';         title = 'Owner'; break;
      case 'media':             category = 'media';         title = 'Media'; break;
      case 'fun':               category = 'fun';           title = 'Fun'; break;
      case 'utility':           category = 'utility';       title = 'Tools'; break;
      case 'entertainment':     category = 'entertainment'; title = 'Entertainment'; break;
      case 'textmaker':         category = 'textmaker';     title = 'TextMaker'; break;
      case 'movies':            category = 'movies';        title = 'Movies'; break;

      // back-compat
      case 'animemenu':         category = 'entertainment'; title = 'Entertainment'; break;
      case 'toolsmenu':         category = 'utility';       title = 'Tools'; break;

      default:
        return sock.sendMessage(chatId, { text: '❌ Invalid menu category!' }, { quoted: msg });
    }

    const list = (categories[category] || []).map(x => x.name).filter(Boolean);
    if (!list.length) {
      return sock.sendMessage(
        chatId,
        { text: `❌ No commands found in ${title}\nFix: plugins must use category: "${category}"` },
        { quoted: msg }
      );
    }

    // page: .menu admin 2  OR .adminmenu 2
    const pageArg = Number(args?.[1] || args?.[0]) || 1;
    const { out, page, totalPages } = renderTwoCols(list, prefix, pageArg, 24);

    const submenuTextRaw =
`${botTitle} • ${title}
Page ${page}/${totalPages} | ${list.length} cmds

${out}

Back: ${prefix}menu
More: ${prefix}menu ${category} ${page + 1}`;

    return sock.sendMessage(
      chatId,
      { text: mono(submenuTextRaw), mentions: [sender] },
      { quoted: msg }
    );
  }
};
