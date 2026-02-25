/**
 * ✅ FINAL UPDATED .menu (Infinity MD)
 * - 8 Random designs
 * - Monospace aligned layouts (fixes WhatsApp ugly spacing)
 * - Optional fancy unicode font headers
 * - Banner image support (random)
 * - Submenus work: .adminmenu .ownermenu .dlmenu .funmenu .aimenu .entertainmentmenu .textmenu .toolmenu .moviemenu .generalmenu
 * - Also supports: .menu admin / .menu media / ...
 *
 * Drop-in file: commands/general/menu.js
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

function monoBlock(text) {
  // WhatsApp monospace block for perfect alignment
  return '```\n' + text + '\n```';
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

// --- Fancy header styles (optional “fonts”) ---
const HEADER_STYLES = {
  normal: (s) => s,
  boldcaps: (s) => s.toUpperCase(),
  boxed: (s) => `【 ${s} 】`,
  stars: (s) => `✦ ${s} ✦`,
  neon: (s) => `⚡🟣 ${s} 🟣⚡`,
  smallcaps: (s) => s.replace(/[a-z]/g, c => c.toUpperCase())
};

function styleHeader(title) {
  const styles = Object.keys(HEADER_STYLES);
  const k = randPick(styles);
  return HEADER_STYLES[k](title);
}

// Helpers for aligned “CONTROL PANEL” rows
function makeAlignedRows(width = 26) {
  const row = (icon, label, value) => {
    const left = `${icon} ${label}`.padEnd(width, ' ');
    return `│ ${left}: ${value}`;
  };
  const navRow = (n, icon, label, cmd) => {
    const left = `[${String(n).padStart(2, '0')}] ${icon} ${label}`.padEnd(width, ' ');
    return `│ ${left}: ${cmd}`;
  };
  return { row, navRow };
}

/**
 * 8 MAIN MENU DESIGNS
 * All designs return a string; designs 2,6,7,8 are monospace aligned (best).
 */
function renderMainMenuDesign(designId, ctx) {
  const { botName, owner, prefix, total, uptime, ram, who, links } = ctx;

  // increase width if you have longer labels
  const W = 28;
  const { row, navRow } = makeAlignedRows(W);

  switch (designId) {
    // 1) Clean card (normal)
    case 1:
      return (
`✨ *${botName}* ✨\n\n` +
`╭───────────────╮\n` +
`│ 👋 Hello *${who}*\n` +
`│ ⚡ Prefix  : *${prefix}*\n` +
`│ 📦 Commands: *${total}*\n` +
`│ 👑 Owner   : *${owner}*\n` +
`│ ⏱ Uptime  : *${uptime}*\n` +
`│ 🧠 RAM     : *${ram} MB*\n` +
`╰───────────────╯\n\n` +
`📚 *MENUS*\n` +
`╭────────────────────────╮\n` +
`│ 🧭 General        → ${links.general}\n` +
`│ 🤖 AI             → ${links.ai}\n` +
`│ 🛡️ Admin          → ${links.admin}\n` +
`│ 👑 Owner          → ${links.owner}\n` +
`│ 🎞️ Media          → ${links.media}\n` +
`│ 🎭 Fun            → ${links.fun}\n` +
`│ 🔧 Utility        → ${links.utility}\n` +
`│ 👾 Entertainment  → ${links.entertainment}\n` +
`│ 🖋 TextMaker      → ${links.textmaker}\n` +
`│ 🎬 Movies         → ${links.movies}\n` +
`╰────────────────────────╯\n\n` +
`🗂 Full list: *${links.full}*\n` +
`💡 Example: *${prefix}menu admin*`
      );

    // 2) CONTROL PANEL (monospace aligned) ✅ fixes ugly alignment
    case 2: {
      const title = styleHeader(`${botName} CONTROL PANEL`);
      const panel =
`${title}
` +
`┌────────────────────────────────────────┐
` +
`${row('👤', 'User', who)}
` +
`${row('👑', 'Owner', owner)}
` +
`${row('⚡', 'Prefix', prefix)}
` +
`${row('📦', 'Commands', total)}
` +
`${row('⏱', 'Uptime', uptime)}
` +
`${row('🧠', 'RAM', `${ram} MB`)}
` +
`└────────────────────────────────────────┘

` +
`🧭 NAVIGATION
` +
`┌────────────────────────────────────────┐
` +
`${navRow(1,  '🧭', 'General', links.general)}
` +
`${navRow(2,  '🤖', 'AI', links.ai)}
` +
`${navRow(3,  '🛡️', 'Admin', links.admin)}
` +
`${navRow(4,  '👑', 'Owner', links.owner)}
` +
`${navRow(5,  '🎞️', 'Media', links.media)}
` +
`${navRow(6,  '🎭', 'Fun', links.fun)}
` +
`${navRow(7,  '🔧', 'Utility', links.utility)}
` +
`${navRow(8,  '👾', 'Entertainment', links.entertainment)}
` +
`${navRow(9,  '🖋️', 'TextMaker', links.textmaker)}
` +
`${navRow(10, '🎬', 'Movies', links.movies)}
` +
`└────────────────────────────────────────┘

` +
`📜 FULL COMMAND LIST → ${links.full}`;

      return monoBlock(panel);
    }

    // 3) Minimal (normal)
    case 3:
      return (
`*${botName}*\n` +
`Hello *${who}* 👋\n\n` +
`• Prefix: *${prefix}*   • Commands: *${total}*\n` +
`• Owner : *${owner}*   • Uptime  : *${uptime}*\n\n` +
`╭──────── MENUS ────────╮\n` +
`│ ${links.general}   | 🧭 General\n` +
`│ ${links.ai}        | 🤖 AI\n` +
`│ ${links.admin}     | 🛡️ Admin\n` +
`│ ${links.owner}     | 👑 Owner\n` +
`│ ${links.media}     | 🎞️ Media\n` +
`│ ${links.fun}       | 🎭 Fun\n` +
`│ ${links.utility}   | 🔧 Utility\n` +
`│ ${links.entertainment} | 👾 Entertainment\n` +
`│ ${links.textmaker} | 🖋 TextMaker\n` +
`│ ${links.movies}    | 🎬 Movies\n` +
`╰───────────────────────╯\n\n` +
`📜 Full: *${links.full}*`
      );

    // 4) Boxed (normal)
    case 4:
      return (
`╔══════════════════════╗\n` +
`║  🤖 ${String(botName).toUpperCase()}\n` +
`╠══════════════════════╣\n` +
`║ 👋 User    : ${who}\n` +
`║ 👑 Owner   : ${owner}\n` +
`║ ⚡ Prefix  : ${prefix}\n` +
`║ 📦 Cmds    : ${total}\n` +
`║ ⏱ Uptime  : ${uptime}\n` +
`║ 🧠 RAM     : ${ram} MB\n` +
`╚══════════════════════╝\n\n` +
`╭─────── MENU LIST ───────╮\n` +
`│ 🧭 ${links.general}\n` +
`│ 🤖 ${links.ai}\n` +
`│ 🛡️ ${links.admin}\n` +
`│ 👑 ${links.owner}\n` +
`│ 🎞️ ${links.media}\n` +
`│ 🎭 ${links.fun}\n` +
`│ 🔧 ${links.utility}\n` +
`│ 👾 ${links.entertainment}\n` +
`│ 🖋 ${links.textmaker}\n` +
`│ 🎬 ${links.movies}\n` +
`╰─────────────────────────╯\n\n` +
`📜 Full Commands: *${links.full}*`
      );

    // 5) Quick buttons (normal)
    case 5:
      return (
`🌀 *${botName} MENU*\n` +
`Hi *${who}* 👋  |  Prefix: *${prefix}*  |  Cmds: *${total}*\n\n` +
`⏱ ${uptime}   🧠 ${ram}MB   👑 ${owner}\n\n` +
`╭──── QUICK MENUS ────╮\n` +
`│ [🧭] ${links.general}\n` +
`│ [🤖] ${links.ai}\n` +
`│ [🛡️] ${links.admin}\n` +
`│ [👑] ${links.owner}\n` +
`│ [🎞️] ${links.media}\n` +
`│ [🎭] ${links.fun}\n` +
`│ [🔧] ${links.utility}\n` +
`│ [👾] ${links.entertainment}\n` +
`│ [🖋] ${links.textmaker}\n` +
`│ [🎬] ${links.movies}\n` +
`╰─────────────────────╯\n\n` +
`📜 Full list: *${links.full}*`
      );

    // 6) Two-column monospace list ✅
    case 6: {
      const menu = [
        ['🧭', 'General', links.general],
        ['🤖', 'AI', links.ai],
        ['🛡️', 'Admin', links.admin],
        ['👑', 'Owner', links.owner],
        ['🎞️', 'Media', links.media],
        ['🎭', 'Fun', links.fun],
        ['🔧', 'Utility', links.utility],
        ['👾', 'Entertainment', links.entertainment],
        ['🖋️', 'TextMaker', links.textmaker],
        ['🎬', 'Movies', links.movies]
      ];

      const left = [];
      const right = [];
      for (let i = 0; i < menu.length; i++) {
        (i % 2 === 0 ? left : right).push(menu[i]);
      }

      const col = (it) => {
        const [ic, name, cmd] = it;
        const l = `${ic} ${name}`.padEnd(16, ' ');
        return `${l} ${cmd}`;
      };

      let body = '';
      const rows = Math.max(left.length, right.length);
      for (let i = 0; i < rows; i++) {
        const a = left[i] ? col(left[i]) : ''.padEnd(26, ' ');
        const b = right[i] ? col(right[i]) : '';
        body += `│ ${a.padEnd(30, ' ')} ${b}\n`;
      }

      const title = styleHeader(`${botName} MENU`);
      const panel =
`${title}
` +
`┌────────────────────────────────────────┐
` +
`${row('👤', 'User', who)}
` +
`${row('⚡', 'Prefix', prefix)}
` +
`${row('📦', 'Commands', total)}
` +
`${row('👑', 'Owner', owner)}
` +
`└────────────────────────────────────────┘

` +
`┌────────────────────────────────────────┐
` +
`${body.trimEnd()}
` +
`└────────────────────────────────────────┘

` +
`📜 FULL → ${links.full}`;

      return monoBlock(panel);
    }

    // 7) Monospace “steps” ✅
    case 7: {
      const title = styleHeader(`${botName} NAV`);
      const panel =
`${title}
` +
`┌────────────────────────────────────────┐
` +
`${row('👋', 'Hello', who)}
` +
`${row('⚡', 'Prefix', prefix)}
` +
`${row('📦', 'Commands', total)}
` +
`${row('⏱', 'Uptime', uptime)}
` +
`└────────────────────────────────────────┘

` +
`1) ${links.general}
` +
`2) ${links.ai}
` +
`3) ${links.admin}
` +
`4) ${links.owner}
` +
`5) ${links.media}
` +
`6) ${links.fun}
` +
`7) ${links.utility}
` +
`8) ${links.entertainment}
` +
`9) ${links.textmaker}
` +
`10) ${links.movies}

` +
`FULL → ${links.full}`;
      return monoBlock(panel);
    }

    // 8) Monospace “dashboard compact” ✅
    default: {
      const title = styleHeader(`${botName} DASH`);
      const panel =
`${title}
` +
`┌────────────────────────────────────────┐
` +
`${row('👤', 'User', who)}
` +
`${row('👑', 'Owner', owner)}
` +
`${row('⚡', 'Prefix', prefix)}
` +
`${row('📦', 'Commands', total)}
` +
`${row('🧠', 'RAM', `${ram} MB`)}
` +
`└────────────────────────────────────────┘

` +
`General: ${links.general}
` +
`AI     : ${links.ai}
` +
`Admin  : ${links.admin}
` +
`Owner  : ${links.owner}
` +
`Media  : ${links.media}
` +
`Fun    : ${links.fun}
` +
`Utility: ${links.utility}
` +
`Entert : ${links.entertainment}
` +
`Text   : ${links.textmaker}
` +
`Movies : ${links.movies}

` +
`FULL → ${links.full}`;
      return monoBlock(panel);
    }
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

        // Prefer monospace designs more often
        const designPool = [2, 6, 8, 1, 3, 4, 5, 7];
        const designId = randPick(designPool);

        const menuText = renderMainMenuDesign(designId, {
          botName,
          owner,
          prefix,
          total,
          uptime,
          ram,
          who,
          links
        });

        // Send with image if exists
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

      // ✅ SUBMENU mapping
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

      // ✅ Submenu: monospace aligned list
      const width = 20;
      const hdr = styleHeader(`${botName} • ${title}`);
      let body = '';
      for (const cmd of list) {
        body += `│ ${(prefix + cmd.name).padEnd(width, ' ')}\n`;
      }

      const panel =
`${hdr}
` +
`┌────────────────────────────────────────┐
` +
`│ Total: ${String(list.length)}
` +
`└────────────────────────────────────────┘

` +
`┌────────────────────────────────────────┐
` +
`${body.trimEnd()}
` +
`└────────────────────────────────────────┘

` +
`Back → ${prefix}menu   |   Full → ${prefix}mainmenu`;

      return sock.sendMessage(
        chatId,
        { text: monoBlock(panel), mentions: sender ? [sender] : [] },
        { quoted: msg }
      );

    } catch (error) {
      return reply(`❌ Error: ${error.message}`);
    }
  }
};
