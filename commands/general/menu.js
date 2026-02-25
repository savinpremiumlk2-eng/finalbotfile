/**
 * ✅ .menu (SINGLE DESIGN + BANNER + FORWARDED STYLE)
 * - Uses ONLY the box design you provided
 * - Sends with banner image (random from utils/banners or utils/bot_image.jpg)
 * - Caption is monospace (perfect alignment)
 * - Keeps forwardedNewsletterMessageInfo (same as your old menu)
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

function mentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function mono(txt) {
  // WhatsApp monospace block for PERFECT alignment
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
    'help',
    'commands',
    'mainmenu', // optional shortcut
    'ownermenu', 'adminmenu', 'dlmenu', 'funmenu', 'aimenu',
    'entertainmentmenu', 'textmenu', 'toolmenu', 'moviemenu', 'generalmenu'
  ],
  category: 'general',
  description: 'Show menu',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {
    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';
    const botName = String(config.botName || 'INFINITY MD');

    // Count commands (dedupe by name)
    const commands = loadCommands();
    const cmdList = Array.isArray(commands)
      ? commands
      : (commands instanceof Map ? Array.from(commands.values()) : []);

    const total = new Set(cmdList.map(c => c?.name).filter(Boolean)).size;

    // Owner name
    const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const owner = ownerNames?.[0] || 'Infinity Team';

    // Stats
    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const who = mentionTag(sender);

    // ✅ YOUR ONE DESIGN (exact look, aligned)
    const menuTextRaw =
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

    // ✅ Send with banner + forwarded style (same pattern as your old code)
    const imgPath = pickMenuImage();
    if (imgPath) {
      const imageBuffer = fs.readFileSync(imgPath);
      return sock.sendMessage(
        chatId,
        {
          image: imageBuffer,
          caption,
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

    // Fallback if no banner found
    return sock.sendMessage(
      chatId,
      {
        text: caption,
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
};
