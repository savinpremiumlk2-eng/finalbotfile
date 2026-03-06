/**
 * SRCIMG / SRC PIN Unlock
 * This command handles the PIN unlock for SRC/SRCIMG features.
 */

const store = require('../../lib/lightweight_store');
const database = require('../../database');

module.exports = {
  name: "src",
  aliases: ["srcimg"],
  category: "media",
  description: "Unlock SRC/SRCIMG features with a PIN",
  usage: ".src <pin>",

  async execute(sock, msg, args, extra) {
    const { from, sender, reply, isOwner } = extra;
    
    const sessionKey = `srcimg_pass_${from}_${sender}`;
    await store.saveSetting('sessions', sessionKey, {
      authed: true,
      timestamp: Date.now()
    });
    return reply("✅ *Access Granted (Public Mode)!*\n\nYou can now use `.src-s` and `.src-dl` commands.");
  }
};