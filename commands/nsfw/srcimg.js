/**
 * NSFW XNXX Search & Info - Secret Command
 */

const axios = require('axios');
const store = require('../../lib/lightweight_store');

module.exports = {
  name: 'srcimg',
  category: 'nsfw',
  description: 'Search XNXX (Secret)',
  usage: '.srcimg <query>',

  async execute(sock, msg, args, extra) {
    const { from, sender, reply, react } = extra;
    const PASSWORD = '0000';
    const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

    try {
      const query = args.join(" ").trim();
      
      // Check if user is in password session
      const sessionKey = `srcimg_pass_${from}_${sender}`;
      const session = await store.getSetting('sessions', sessionKey);

      if (!session || Date.now() > session.expiresAt) {
        if (query === PASSWORD) {
          // Correct password, save session for 5 minutes
          await store.saveSetting('sessions', sessionKey, { 
            authed: true, 
            expiresAt: Date.now() + 5 * 60 * 1000 
          });
          return reply("✅ Password correct! Now use .srcimg <query> to search.");
        } else {
          // No session or wrong password in query
          await store.saveSetting('sessions', sessionKey, { 
            authed: false, 
            expiresAt: Date.now() + 1 * 60 * 1000 // 1 minute to enter password
          });
          return reply("🔑 This is a secret command. Please provide the password to continue.\nUsage: .srcimg 0000");
        }
      }

      // If we reach here, user is authenticated
      if (!query) return reply("❌ Give search query.");

      await react("⏳");

      const apiUrl = `https://api.srihub.store/nsfw/xnxxsearch?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data.success || !data.result || data.result.length === 0) {
        await react("❌");
        return reply("❌ No results found.");
      }

      let text = `🔞 *XNXX Search Results*\n\n`;
      data.result.slice(0, 10).forEach((res, i) => {
        text += `*${i + 1}.* ${res.title}\n`;
        text += `⏱ Duration: ${res.duration || 'N/A'}\n`;
        text += `🔗 Link: ${res.link}\n\n`;
      });
      text += `> INFINITY MD`;

      await sock.sendMessage(from, { text }, { quoted: msg });
      await react("✅");

    } catch (err) {
      console.log(err.response?.data || err.message);
      await react("❌");
      reply("❌ API Error. Check console.");
    }
  }
};
