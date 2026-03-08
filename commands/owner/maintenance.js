const database = require('../../database');

module.exports = {
  name: 'maintenance',
  aliases: ['maint'],
  category: 'owner',
  description: 'Toggle maintenance mode on/off',
  usage: '.maintenance [on/off]',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const current = globalSettings.maintenance ? 'ON' : 'OFF';

      if (!args[0]) {
        const emoji = globalSettings.maintenance ? '🔧' : '✅';
        return extra.reply(
          `${emoji} *Maintenance Mode*\n\n` +
          `Status: *${current}*\n\n` +
          `Usage:\n` +
          `  .maintenance on - Enable maintenance\n` +
          `  .maintenance off - Disable maintenance\n\n` +
          `When enabled, only the owner can use the bot.`
        );
      }

      const value = args[0].toLowerCase();
      if (value !== 'on' && value !== 'off') {
        return extra.reply('❌ Invalid option! Use: .maintenance on/off');
      }

      const newValue = value === 'on';
      if (globalSettings.maintenance === newValue) {
        return extra.reply(`🔧 Maintenance mode is already *${current}*`);
      }

      await database.updateGlobalSettings({ maintenance: newValue });
      const emoji = newValue ? '🔧' : '✅';
      return extra.reply(`${emoji} Maintenance mode turned *${value.toUpperCase()}*${newValue ? '\nOnly owner can use the bot now.' : '\nBot is now available for everyone.'}`);
    } catch (error) {
      console.error('Maintenance command error:', error);
      await extra.reply('❌ Error toggling maintenance mode.');
    }
  }
};
