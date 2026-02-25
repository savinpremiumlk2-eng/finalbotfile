const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

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

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mono(txt) {
  return "```\n" + txt + "\n```";
}

module.exports = {
  name: 'menu',
  aliases: [
    'help','commands',
    'ownermenu','adminmenu','dlmenu','funmenu','aimenu',
    'entertainmentmenu','textmenu','toolmenu','moviemenu','generalmenu'
  ],
  category: 'general',
  description: 'Show menu',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {

    const chatId = extra?.from || msg?.key?.remoteJid;
    const sender = extra?.sender || msg?.key?.participant || chatId;

    const prefix = config.prefix || '.';
    const botName = config.botName || 'INFINITY MD';

    // count commands
    const commands = loadCommands();
    const cmdList = Array.isArray(commands)
      ? commands
      : (commands instanceof Map ? Array.from(commands.values()) : []);
    const total = new Set(cmdList.map(c => c?.name).filter(Boolean)).size;

    const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
    const owner = ownerNames?.[0] || 'Infinity Team';

    const uptime = formatUptime(process.uptime());
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const who = mentionTag(sender);

    // ---- DESIGN 1 (BOX PANEL) ----
    const design1 =
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

    // ---- DESIGN 2 (QUICK STYLE) ----
    const design2 =
`🌀 ${botName} MENU
Hi ${who} 👋  |  Prefix: ${prefix}  |  Cmds: ${total}

⏱ ${uptime}   🧠 ${ram}MB   👑 ${owner}

╭──── QUICK MENUS ────╮
│ [🧭] ${prefix}generalmenu
│ [🤖] ${prefix}aimenu
│ [🛡️] ${prefix}adminmenu
│ [👑] ${prefix}ownermenu
│ [🎞️] ${prefix}dlmenu
│ [🎭] ${prefix}funmenu
│ [🔧] ${prefix}toolmenu
│ [👾] ${prefix}entertainmentmenu
│ [🖋] ${prefix}textmenu
│ [🎬] ${prefix}moviemenu
╰─────────────────────╯

📜 Full list: ${prefix}mainmenu`;

    // pick randomly
    const finalText = mono(rand([design1, design2]));

    return sock.sendMessage(
      chatId,
      {
        text: finalText,
        mentions: [sender]
      },
      { quoted: msg }
    );
  }
};
