const database = require('../../database');

module.exports = {
  name: 'antiviewonce',
  aliases: ['antivo', 'viewonceguard'],
  description: 'Toggle anti-viewonce protection (auto-reveal view-once messages)',
  usage: '.antiviewonce [on/off]',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const current = globalSettings.antiviewonce || false;

      if (!args[0]) {
        const status = current ? '✅ ON' : '❌ OFF';
        return extra.reply(
          `🛡️ *Anti-ViewOnce*\n\n` +
          `Status: *${status}*\n\n` +
          `When enabled, view-once messages (photos/videos) will be automatically revealed and resent as normal messages.\n\n` +
          `Usage:\n` +
          `  .antiviewonce on - Enable\n` +
          `  .antiviewonce off - Disable`
        );
      }

      const value = args[0].toLowerCase();
      if (value !== 'on' && value !== 'off') {
        return extra.reply('❌ Invalid option!\nUsage: .antiviewonce on/off');
      }

      const newValue = value === 'on';
      if (newValue === current) {
        return extra.reply(`🛡️ Anti-ViewOnce is already *${value.toUpperCase()}*`);
      }

      await database.updateGlobalSettings({ antiviewonce: newValue });
      const emoji = newValue ? '✅' : '❌';
      return extra.reply(`${emoji} Anti-ViewOnce has been turned *${value.toUpperCase()}*`);

    } catch (error) {
      console.error('AntiViewOnce command error:', error);
      await extra.reply('❌ Error toggling anti-viewonce.');
    }
  }
};
