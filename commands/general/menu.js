/**
 * Menu Command - Display all available commands
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'menu',
  aliases: [
    'help', 'commands',
    'ownermenu', 'groupmenu', 'dlmenu', 'funmenu', 'aimenu',
    'stickermenu', 'audiomenu', 'videomenu', 'searchmenu',
    'toolsmenu', 'convertmenu', 'settingsmenu', 'dbmenu',
    'othermenu', 'animemenu', 'textmenu', 'moviemenu'
  ],
  category: 'general',
  description: 'Show all available commands',
  usage: '.menu',

  async execute(sock, msg, args = [], extra = {}) {
    const reply = extra?.reply
      ? extra.reply.bind(extra)
      : async (text) => {
          const jid = extra?.from || msg?.key?.remoteJid;
          return sock.sendMessage(jid, { text }, { quoted: msg });
        };

    try {
      const commands = loadCommands(); // Map or Array depending on your loader
      const categories = {};

      // Normalize commands into an array
      const cmdList = Array.isArray(commands)
        ? commands
        : (commands instanceof Map ? Array.from(commands.values()) : []);

      // Dedupe by command name (prevents alias duplicates + weird loader behavior)
      const seen = new Set();
      for (const cmd of cmdList) {
        if (!cmd?.name) continue;
        if (seen.has(cmd.name)) continue;
        seen.add(cmd.name);

        const cat = (cmd.category || 'other').toLowerCase();
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd);
      }

      // Owner display
      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
      const displayOwner = ownerNames?.[0] || 'Bot Owner';

      // Uptime
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeString = `${hours}h ${minutes}m ${seconds}s`;

      // RAM
      const ramUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

      // Detect submenu either from ".menu xxx" or alias command like ".ownermenu"
      const usedCommand = (extra?.commandName || '').toLowerCase();
      const subMenu =
        (args[0] && String(args[0]).toLowerCase()) ||
        (usedCommand.endsWith('menu') ? usedCommand : null);

      const chatId = extra?.from || msg?.key?.remoteJid;
      const sender = extra?.sender;

      // Main menu
      if (!subMenu || subMenu === 'menu') {
        let menuText = `🤖 *MAIN MENU*\n`;
        menuText += `╭───〔 🤖 INFINITY MD 〕───\n`;
        menuText += `│ 👤 *Owner* : ${displayOwner}\n`;
        menuText += `│ 📊 *Commands* : ${seen.size}\n`;
        menuText += `│ ⏱ *Uptime* : ${uptimeString}\n`;
        menuText += `│ 🚀 *RAM* : ${ramUsage}MB\n`;
        menuText += `│ ⌨️ *Prefix* : ${config.prefix}\n`;
        menuText += `╰────────────────────\n\n`;

        menuText += `╭───〔 📂 MAIN MENUS 〕───\n`;
        menuText += `│ 👑 ${config.prefix}ownermenu\n`;
        menuText += `│ 🧩 ${config.prefix}groupmenu\n`;
        menuText += `│ 📥 ${config.prefix}dlmenu\n`;
        menuText += `│ 🎮 ${config.prefix}funmenu\n`;
        menuText += `│ 🤖 ${config.prefix}aimenu\n`;
        menuText += `│ 🖼 ${config.prefix}stickermenu\n`;
        menuText += `│ 🎵 ${config.prefix}audiomenu\n`;
        menuText += `│ 🎥 ${config.prefix}videomenu\n`;
        menuText += `│ 🔍 ${config.prefix}searchmenu\n`;
        menuText += `│ 🛠 ${config.prefix}toolsmenu\n`;
        menuText += `│ 🧠 ${config.prefix}convertmenu\n`;
        menuText += `│ ⚙️ ${config.prefix}settingsmenu\n`;
        menuText += `│ 🗄 ${config.prefix}dbmenu\n`;
        menuText += `│ 🌸 ${config.prefix}animemenu\n`;
        menuText += `│ ✍️ ${config.prefix}textmenu\n`;
        menuText += `│ 🎬 ${config.prefix}moviemenu\n`;
        menuText += `│ 🧪 ${config.prefix}othermenu\n`;
        menuText += `╰────────────────────\n\n`;
        menuText += `> 💫 *INFINITY MD* - Powered by AI`;

        // Banner logic
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

      // Submenu mapping (FIX THESE CATEGORY NAMES to match your plugins)
      // I made them more logical; change if your commands use different category strings.
      let category = '';
      let title = '';

      switch (subMenu) {
        case 'ownermenu':     category = 'owner';     title = '👑 OWNER MENU'; break;
        case 'settingsmenu':  category = 'settings';  title = '⚙️ SETTINGS MENU'; break;
        case 'dbmenu':        category = 'database';  title = '🗄 DATABASE MENU'; break;

        case 'groupmenu':     category = 'group';     title = '🧩 GROUP MENU'; break;

        case 'dlmenu':        category = 'download';  title = '📥 DOWNLOAD MENU'; break;
        case 'audiomenu':     category = 'audio';     title = '🎵 AUDIO MENU'; break;
        case 'videomenu':     category = 'video';     title = '🎥 VIDEO MENU'; break;

        case 'funmenu':       category = 'fun';       title = '🎮 FUN MENU'; break;
        case 'aimenu':        category = 'ai';        title = '🤖 AI MENU'; break;

        case 'stickermenu':   category = 'sticker';   title = '🖼 STICKER MENU'; break;
        case 'searchmenu':    category = 'search';    title = '🔍 SEARCH MENU'; break;
        case 'toolsmenu':     category = 'utility';   title = '🛠 TOOLS MENU'; break;
        case 'convertmenu':   category = 'convert';   title = '🧠 CONVERT MENU'; break;

        case 'animemenu':     category = 'anime';     title = '🌸 ANIME MENU'; break;
        case 'textmenu':      category = 'textmaker'; title = '✍️ TEXT MENU'; break;
        case 'moviemenu':     category = 'movies';    title = '🎬 MOVIE MENU'; break;
        case 'othermenu':     category = 'other';     title = '🧪 OTHER MENU'; break;

        default:
          return reply('❌ Invalid menu category!');
      }

      const list = categories[category];
      if (!list || !list.length) {
        return reply(`❌ No commands found in ${title}\n\nTip: Your plugins may use a different "category" name than "${category}".`);
      }

      // Sort commands
      list.sort((a, b) => String(a.name).localeCompare(String(b.name)));

      let text = `╭───〔 ${title} 〕───\n`;
      for (const cmd of list) {
        text += `│ ➜ ${config.prefix}${cmd.name}\n`;
      }
      text += `╰────────────────────\n\n`;
      text += `> 💫 *INFINITY MD* - Powered by AI`;

      return reply(text);

    } catch (error) {
      return reply(`❌ Error: ${error.message}`);
    }
  }
};