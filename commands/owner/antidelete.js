const fs = require('fs');
const path = require('path');
const database = require('../../database');

module.exports = {
  name: 'antidelete',
  aliases: ['ad'],
  category: 'owner',
  description: 'Configure anti-delete settings',
  usage: '.antidelete <on/off/status/private/chat/group>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const action = args[0]?.toLowerCase();
      const settings = database.getGlobalSettings();
      
      if (!action || action === 'status') {
        return extra.reply(`🛡️ *ANTI-DELETE STATUS*\n\n` +
          `• Main: ${settings.antidelete ? '✅' : '❌'}\n` +
          `• Private: ${settings.antideletePrivate ? '✅' : '❌'}\n` +
          `• Groups: ${settings.antideleteGroup ? '✅' : '❌'}\n\n` +
          `*Commands:*\n` +
          `.antidelete on/off\n` +
          `.antidelete private\n` +
          `.antidelete group`);
      }

      if (action === 'on') {
        database.updateGlobalSettings({ antidelete: true });
        return extra.reply('✅ Anti-delete enabled globally.');
      }
      if (action === 'off') {
        database.updateGlobalSettings({ antidelete: false });
        return extra.reply('❌ Anti-delete disabled globally.');
      }
      if (action === 'private' || action === 'chat') {
        const newState = !settings.antideletePrivate;
        database.updateGlobalSettings({ antideletePrivate: newState });
        return extra.reply(`💬 Anti-delete for Private Chats: ${newState ? 'ON' : 'OFF'}`);
      }
      if (action === 'group' || action === 'groups') {
        const newState = !settings.antideleteGroup;
        database.updateGlobalSettings({ antideleteGroup: newState });
        return extra.reply(`👥 Anti-delete for Groups: ${newState ? 'ON' : 'OFF'}`);
      }

      extra.reply('❌ Invalid option. Use: on | off | private | group');
    } catch (err) {
      console.error('[antidelete cmd] error:', err);
      extra.reply('❌ Error configuring anti-delete.');
    }
  }
};
