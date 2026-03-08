const config = require('../../config');
const database = require('../../database');

module.exports = {
  name: 'mode',
  aliases: ['botmode', 'privatemode', 'publicmode'],
  description: 'Toggle bot between private and public mode',
  usage: '.mode <private/public>',
  category: 'owner',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      const globalSettings = database.getGlobalSettingsSync();
      const currentMode = globalSettings.forceBot ? 'private' : 'public';

      if (!args[0]) {
        const modeEmoji = globalSettings.forceBot ? '🔒' : '🌐';
        const description = globalSettings.forceBot 
          ? 'Only owner can use commands'
          : 'Everyone can use commands';
        
        return extra.reply(
          `🤖 *Bot Mode*\n\n` +
          `${modeEmoji} Current Mode: *${currentMode.toUpperCase()}*\n` +
          `Status: ${description}\n\n` +
          `Usage:\n` +
          `  .mode private - Only owner can use\n` +
          `  .mode public - Everyone can use`
        );
      }
      
      const mode = args[0].toLowerCase();
      
      if (mode === 'private' || mode === 'priv') {
        if (globalSettings.forceBot) {
          return extra.reply('🔒 Bot is already in *PRIVATE* mode.\nOnly owner can use commands.');
        }
        
        await database.updateGlobalSettings({ forceBot: true });
        return extra.reply('🔒 Bot mode changed to *PRIVATE*\n\nOnly owner can use commands now.');
      }
      
      if (mode === 'public' || mode === 'pub') {
        if (!globalSettings.forceBot) {
          return extra.reply('🌐 Bot is already in *PUBLIC* mode.\nEveryone can use commands.');
        }
        
        await database.updateGlobalSettings({ forceBot: false });
        return extra.reply('🌐 Bot mode changed to *PUBLIC*\n\nEveryone can use commands now.');
      }
      
      return extra.reply('❌ Invalid mode!\nUsage: .mode <private/public>');
      
    } catch (error) {
      console.error('Mode command error:', error);
      await extra.reply('❌ Error changing bot mode.');
    }
  }
};
