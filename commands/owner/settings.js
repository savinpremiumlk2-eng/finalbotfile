const config = require('../../config');
const database = require('../../database');

module.exports = {
  name: 'settings',
  aliases: ['botsettings', 'botconfig'],
  description: 'View and manage all bot settings',
  usage: '.settings [setting] [on/off]',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();

      if (!args[0]) {
        const on = '✅';
        const off = '❌';
        const s = (v) => v ? on : off;

        let text = `⚙️ *BOT SETTINGS*\n`;
        text += `╭───〔 🤖 Bot Info 〕───\n`;
        text += `│ 📛 *Name* : ${config.botName || 'Infinity MD'}\n`;
        text += `│ ⌨️ *Prefix* : ${config.prefix || '.'}\n`;
        text += `│ ⏱ *Uptime* : ${formatUptime(process.uptime())}\n`;
        text += `╰────────────────────\n\n`;

        text += `╭───〔 🔐 Bot Mode 〕───\n`;
        text += `│ ${s(globalSettings.forceBot)} *Private Mode* (forceBot)\n`;
        text += `│ ${s(globalSettings.maintenance)} *Maintenance Mode*\n`;
        text += `╰────────────────────\n\n`;

        text += `╭───〔 🛡️ Protection 〕───\n`;
        text += `│ ${s(globalSettings.antidelete)} *Anti-Delete*\n`;
        text += `│ ${s(globalSettings.antiviewonce)} *Anti-ViewOnce*\n`;
        text += `│ ${s(config.anticall)} *Anti-Call*\n`;
        text += `╰────────────────────\n\n`;

        text += `╭───〔 🤖 Auto Features 〕───\n`;
        text += `│ ${s(globalSettings.autoReact)} *Auto-React*\n`;
        text += `│ ${s(globalSettings.autoStatus)} *Auto-Status View*\n`;
        text += `│ ${s(globalSettings.autoTyping || config.autoTyping)} *Auto-Typing*\n`;
        text += `│ ${s(globalSettings.autoVoice || config.autoVoice)} *Auto-Voice*\n`;
        text += `╰────────────────────\n\n`;

        text += `╭───〔 📋 Quick Commands 〕───\n`;
        text += `│ .settings antiviewonce on/off\n`;
        text += `│ .settings antidelete on/off\n`;
        text += `│ .settings autoreact on/off\n`;
        text += `│ .settings autostatus on/off\n`;
        text += `│ .settings autotyping on/off\n`;
        text += `│ .settings autovoice on/off\n`;
        text += `│ .settings maintenance on/off\n`;
        text += `│ .mode private/public\n`;
        text += `╰────────────────────`;

        return extra.reply(text);
      }

      const setting = args[0].toLowerCase();
      const value = args[1] ? args[1].toLowerCase() : null;

      const toggleSettings = {
        'antiviewonce': 'antiviewonce',
        'antidelete': 'antidelete',
        'autoreact': 'autoReact',
        'autostatus': 'autoStatus',
        'autotyping': 'autoTyping',
        'autovoice': 'autoVoice',
        'maintenance': 'maintenance',
        'forcebot': 'forceBot',
      };

      const settingKey = toggleSettings[setting];
      if (!settingKey) {
        return extra.reply(
          `❌ Unknown setting: *${setting}*\n\n` +
          `Available settings:\n` +
          Object.keys(toggleSettings).map(k => `• ${k}`).join('\n') +
          `\n\nUsage: .settings <name> <on/off>`
        );
      }

      if (!value || (value !== 'on' && value !== 'off')) {
        const current = globalSettings[settingKey] ? 'ON' : 'OFF';
        return extra.reply(
          `⚙️ *${setting}* is currently: *${current}*\n\n` +
          `Usage: .settings ${setting} on/off`
        );
      }

      const newValue = value === 'on';
      await database.updateGlobalSettings({ [settingKey]: newValue });

      const emoji = newValue ? '✅' : '❌';
      return extra.reply(`${emoji} *${setting}* has been turned *${value.toUpperCase()}*`);

    } catch (error) {
      console.error('Settings command error:', error);
      await extra.reply('❌ Error managing settings.');
    }
  }
};

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}
