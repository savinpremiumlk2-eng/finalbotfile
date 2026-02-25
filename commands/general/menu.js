/**
 * .menu - Compact menu + submenus
 * - .menu (shows menu list)
 * - .ownermenu, .adminmenu, .dlmenu, .funmenu, .aimenu, .entertainmentmenu, .textmenu, .toolmenu, .moviemenu, .generalmenu
 * - Also supports: .menu owner / .menu admin / .menu media ... (category names)
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

module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',

    // sub menu commands
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
      const p = config.prefix || '.';

      const commands = loadCommands();
      const categories = {};

      const cmdList = Array.isArray(commands)
        ? commands
        : (commands instanceof Map ? Array.from(commands.values()) : []);

      // dedupe by name
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
      const displayOwner = ownerNames?.[0] || 'Infinity Team';

      const uptimeString = formatUptime(process.uptime());
      const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

      const usedCommand = String(extra?.commandName || '').toLowerCase();
      const subMenu =
        (args[0] && String(args[0]).toLowerCase()) ||
        (usedCommand.endsWith('menu') ? usedCommand : null);

      const chatId = extra?.from || msg?.key?.remoteJid;
      const sender = extra?.sender;

      // MAIN MENU (compact)
      if (!subMenu || subMenu === 'menu') {
        let menuText = `╭━━『 ${String(config.botName || 'Infinity MD')} 』━━╮\n`;
        menuText += `│ ⚡ Prefix: ${p}\n`;
        menuText += `│ 📦 Total Commands: ${seen.size}\n`;
        menuText += `│ 👑 Owner: ${displayOwner}\n`;
        menuText += `│ ⏱ Uptime: ${uptimeString}\n`;
        menuText += `│ 🧠 RAM: ${ramUsage} MB\n`;
        menuText += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

        menuText += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
        menuText += `┃ 📂 MAIN MENUS\n`;
        menuText += `┗━━━━━━━━━━━━━━━━━━━━━━\n`;
        menuText += `│ 👑 Owner         : ${p}ownermenu\n`;
        menuText += `│ 🛡 Admin         : ${p}adminmenu\n`;
        menuText += `│ 🎞 Media/Download: ${p}dlmenu\n`;
        menuText += `│ 🎭 Fun           : ${p}funmenu\n`;
        menuText += `│ 🤖 AI            : ${p}aimenu\n`;
        menuText += `│ 👾 Entertainment : ${p}entertainmentmenu\n`;
        menuText += `│ 🖋 TextMaker     : ${p}textmenu\n`;
        menuText += `│ 🔧 Utility/Tools : ${p}toolmenu\n`;
        menuText += `│ 🎬 Movies        : ${p}moviemenu\n`;
        menuText += `│ 🧭 General       : ${p}generalmenu\n`;
        menuText += `│ 📜 Full List     : ${p}mainmenu\n`;
        menuText += `┗━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        menuText += `💡 Tip: ${p}menu <category>  (ex: ${p}menu admin)\n`;
        menuText += `✨ *INFINITY MD*`;

        // Banner / image (optional)
        const bannersPath = path.join(__dirname, '../../utils/banners');
        let imagePath = path.join(__dirname, '../../utils/bot_image.jpg');

        if (fs.existsSync(bannersPath)) {
          const banners = fs.readdirSync(bannersPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
          if (banners.length) {
            imagePath = path.join(bannersPath, banners[Math.floor(Math.random() * banners.length)]);
          }
        }

        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          await sock.sendMessage(chatId, {
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
          }, { quoted: msg });
        } else {
          await sock.sendMessage(chatId, { text: menuText, mentions: sender ? [sender] : [] }, { quoted: msg });
        }
        return;
      }

      // submenu mapping
      let category = '';
      let title = '';

      switch (subMenu) {
        // submenu commands
        case 'generalmenu':         category = 'general';       title = '🧭 GENERAL COMMAND'; break;
        case 'aimenu':              category = 'ai';            title = '🤖 AI COMMAND'; break;
        case 'adminmenu':           category = 'admin';         title = '🛡️ ADMIN COMMAND'; break;
        case 'ownermenu':           category = 'owner';         title = '👑 OWNER COMMAND'; break;
        case 'dlmenu':              category = 'media';         title = '🎞️ MEDIA COMMAND'; break;
        case 'funmenu':             category = 'fun';           title = '🎭 FUN COMMAND'; break;
        case 'toolmenu':            category = 'utility';       title = '🔧 UTILITY COMMAND'; break;
        case 'entertainmentmenu':   category = 'entertainment'; title = '👾 ENTERTAINMENT COMMAND'; break;
        case 'textmenu':            category = 'textmaker';     title = '🖋️ TEXTMAKER COMMAND'; break;
        case 'moviemenu':           category = 'movies';        title = '🎬 MOVIES COMMAND'; break;

        // support ".menu admin" style
        case 'general':             category = 'general';       title = '🧭 GENERAL COMMAND'; break;
        case 'ai':                  category = 'ai';            title = '🤖 AI COMMAND'; break;
        case 'admin':               category = 'admin';         title = '🛡️ ADMIN COMMAND'; break;
        case 'owner':               category = 'owner';         title = '👑 OWNER COMMAND'; break;
        case 'media':               category = 'media';         title = '🎞️ MEDIA COMMAND'; break;
        case 'fun':                 category = 'fun';           title = '🎭 FUN COMMAND'; break;
        case 'utility':             category = 'utility';       title = '🔧 UTILITY COMMAND'; break;
        case 'entertainment':       category = 'entertainment'; title = '👾 ENTERTAINMENT COMMAND'; break;
        case 'textmaker':           category = 'textmaker';     title = '🖋️ TEXTMAKER COMMAND'; break;
        case 'movies':              category = 'movies';        title = '🎬 MOVIES COMMAND'; break;

        // backward compatibility
        case 'animemenu':           category = 'entertainment'; title = '👾 ENTERTAINMENT COMMAND'; break;
        case 'toolsmenu':           category = 'utility';       title = '🔧 UTILITY COMMAND'; break;

        default:
          return reply('❌ Invalid menu category!');
      }

      const list = categories[category];
      if (!list || !list.length) {
        return reply(
          `❌ No commands found in ${title}\n\n` +
          `✅ Make sure your plugins use:\n` +
          `category: "${category}"`
        );
      }

      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

      let text = `╭━━『 ${String(config.botName || 'Infinity MD')} 』━━╮\n`;
      text += `┃ ${title}\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

      text += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `┃ Commands (${list.length})\n`;
      text += `┗━━━━━━━━━━━━━━━━━━━━━━\n`;
      for (const cmd of list) {
        text += `│ ➜ ${p}${cmd.name}\n`;
      }
      text += `┗━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `💡 Tip: ${p}mainmenu (for full list)\n`;
      text += `✨ *INFINITY MD*`;

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
