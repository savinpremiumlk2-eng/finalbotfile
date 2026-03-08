const config = require('../../config');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'alive',
  aliases: ['bot', 'isalive'],
  category: 'general',
  description: 'Check if bot is alive with fancy text',
  usage: '.alive',

  async execute(sock, msg, args, extra) {
    try {
      const botName = config.botName || 'Infinity MD';
      const ownerName = Array.isArray(config.ownerName) ? config.ownerName[0] : (config.ownerName || 'Infinity Team');
      const prefix = config.prefix || '.';

      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const greetings = [
        'Hey there! I am alive and kicking! 🚀',
        'Yes, I am online and ready to serve! ⚡',
        'I am up and running smoothly! 🌟',
        'Bot is alive and working perfectly! 💫',
        'Hello! I am here and active! 🎯'
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];

      let text = `╭━━━━━━━━━━━━━━━━━━━━╮\n`;
      text += `┃  ✨ *${botName}* ✨\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `${greeting}\n\n`;
      text += `╭━━〔 📋 STATUS 〕━━╮\n`;
      text += `┃ 🟢 *Status* : Online\n`;
      text += `┃ ⏱ *Uptime* : ${hours}h ${minutes}m ${seconds}s\n`;
      text += `┃ 👑 *Owner* : ${ownerName}\n`;
      text += `┃ ⌨️ *Prefix* : ${prefix}\n`;
      text += `┃ 🏷 *Version* : v2.0.0\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
      text += `> Type *${prefix}menu* to see all commands`;

      const imagePath = path.join(__dirname, '../../utils/bot_image.jpg');
      if (fs.existsSync(imagePath)) {
        await sock.sendMessage(extra.from, {
          image: fs.readFileSync(imagePath),
          caption: text
        }, { quoted: msg });
      } else {
        await extra.reply(text);
      }
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
