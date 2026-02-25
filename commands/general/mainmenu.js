/**
 * .mainmenu - FULL menu with ALL commands (grouped by categories)
 * Style matches your example but improved.
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function getMentionTag(jid = '') {
  const num = String(jid).split('@')[0] || '';
  return num ? `@${num}` : '@user';
}

function buildSection(title, items, prefix) {
  if (!items || !items.length) return '';
  const lines = items
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map(cmd => `│ ➜ ${prefix}${cmd}`)
    .join('\n');

  return (
    `┏━━━━━━━━━━━━━━━━━\n` +
    `┃ ${title}\n` +
    `┗━━━━━━━━━━━━━━━━━\n` +
    `${lines}\n\n`
  );
}

module.exports = {
  name: 'mainmenu',
  aliases: ['allmenu', 'fullmenu'],
  category: 'general',
  description: 'Show full menu with all commands',
  usage: '.mainmenu',

  async execute(sock, msg, args = [], extra = {}) {
    const reply = extra?.reply
      ? extra.reply.bind(extra)
      : async (text) => {
          const jid = extra?.from || msg?.key?.remoteJid;
          return sock.sendMessage(jid, { text }, { quoted: msg });
        };

    try {
      const p = config.prefix || '.';
      const chatId = extra?.from || msg?.key?.remoteJid;
      const sender = extra?.sender || msg?.key?.participant || chatId;

      const commands = loadCommands();
      const cmdList = Array.isArray(commands)
        ? commands
        : (commands instanceof Map ? Array.from(commands.values()) : []);

      const seen = new Set();
      const bucket = {
        general: [],
        ai: [],
        admin: [],
        owner: [],
        media: [],
        fun: [],
        utility: [],
        entertainment: [],
        textmaker: [],
        movies: [],
        other: []
      };

      for (const cmd of cmdList) {
        if (!cmd?.name) continue;
        if (seen.has(cmd.name)) continue;
        seen.add(cmd.name);

        const cat = String(cmd.category || 'other').toLowerCase().trim();
        if (!bucket[cat]) bucket.other.push(cmd.name);
        else bucket[cat].push(cmd.name);
      }

      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
      const displayOwner = ownerNames?.[0] || 'Infinity Team';

      const total = seen.size;
      const uptime = formatUptime(process.uptime());
      const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
      const version = config.version || '1.0.0';

      let text = `╭━━『 ${String(config.botName || 'Infinity MD')} 』━━╮\n\n`;
      text += `👋 Hello ${getMentionTag(sender)}!\n\n`;
      text += `⚡ Prefix: ${p}\n`;
      text += `📦 Total Commands: ${total}\n`;
      text += `👑 Owner: ${displayOwner}\n`;
      text += `⏱ Uptime: ${uptime}\n`;
      text += `🧠 RAM: ${ramUsage} MB\n`;
      text += `╰━━━━━━━━━━━━━━━━━\n\n`;

      text += buildSection('🧭 GENERAL COMMAND', bucket.general, p);
      text += buildSection('🤖 AI COMMAND', bucket.ai, p);
      text += buildSection('🛡️ ADMIN COMMAND', bucket.admin, p);
      text += buildSection('👑 OWNER COMMAND', bucket.owner, p);
      text += buildSection('🎞️ MEDIA COMMAND', bucket.media, p);
      text += buildSection('🎭 FUN COMMAND', bucket.fun, p);
      text += buildSection('🔧 UTILITY COMMAND', bucket.utility, p);
      text += buildSection('👾 ENTERTAINMENT COMMAND', bucket.entertainment, p);
      text += buildSection('🖋️ TEXTMAKER COMMAND', bucket.textmaker, p);
      text += buildSection('🎬 MOVIES COMMAND', bucket.movies, p);

      if (bucket.other.length) {
        text += buildSection('🧪 OTHER COMMAND', bucket.other, p);
      }

      text += `╰━━━━━━━━━━━━━━━━━\n\n`;
      text += `💡 Type ${p}help <command> for more info\n`;
      text += `🌟 Bot Version: ${version}`;

      return sock.sendMessage(
        chatId,
        { text, mentions: sender ? [sender] : [] },
        { quoted: msg }
      );

    } catch (e) {
      return reply(`❌ Error: ${e.message}`);
    }
  }
};
