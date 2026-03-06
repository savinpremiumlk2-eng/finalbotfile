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
    
    const pin = args[0];
    const CORRECT_PIN = "0000";

    if (!pin) return reply("🔑 Please provide a PIN. Example: .src 0000");
    if (pin !== CORRECT_PIN) return reply("❌ Invalid PIN. Access Denied.");

    const sessionKey = `srcimg_pass_${from}_${sender}`;
    await store.saveSetting('sessions', sessionKey, {
      authed: true,
      timestamp: Date.now()
    });
    return reply("✅ *Access Granted!*\n\nYou can now use `.src-s` and `.src-dl` commands.");
  }
};