
const config = require('../../config');
const fs = require('fs');
const path = require('path');
const database = require('../../database');

module.exports = {
  name: 'autostatus',
  aliases: ['as'],
  description: 'Toggle auto-view status',
  usage: '.autostatus <on/off>',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, { reply, react }) {
    try {
      const settings = database.getGlobalSettings();
      if (!args[0]) {
        return reply(`👀 *Auto Status View*\n\nCurrent Status: *${settings.autoStatus ? 'ON' : 'OFF'}*\n\nUsage:\n  .autostatus on\n  .autostatus off`);
      }

      const opt = args[0].toLowerCase();
      if (opt === 'on') {
        settings.autoStatus = true;
        database.updateGlobalSettings(settings);
        await reply('✅ Auto Status View is now *ON*');
      } else if (opt === 'off') {
        settings.autoStatus = false;
        database.updateGlobalSettings(settings);
        await reply('✅ Auto Status View is now *OFF*');
      } else {
        reply('❌ Invalid option! Use on/off');
      }
    } catch (error) {
      console.error('AutoStatus error:', error);
      reply('❌ Error updating auto status.');
    }
  }
};
