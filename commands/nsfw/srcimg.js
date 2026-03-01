/**
 * XNXX Search - Secret Command (Protected)
 */

const axios = require('axios');
const store = require('../../lib/lightweight_store');

module.exports = {
  name: 'srcimg',
  aliases: [],
  category: 'media',
  description: 'Secret search command',
  usage: '.srcimg <query>',

  async execute(sock, msg, args, extra) {
    const { from, sender, reply, react } = extra;

    const PASSWORD = '0000';
    const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

    try {
      const query = args.join(" ").trim();

      const sessionKey = `srcimg_pass_${from}_${sender}`;
      const session = await store.getSetting('sessions', sessionKey);

      // 🔐 Authentication Check
      if (!session || Date.now() > session.expiresAt || !session.authed) {
        if (query === PASSWORD) {
          await store.saveSetting('sessions', sessionKey, {
            authed: true,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes session
          });

          return reply("✅ Access granted. Now use .srcimg <query> to search.");
        } else {
          await store.saveSetting('sessions', sessionKey, {
            authed: false,
            expiresAt: Date.now() + 1 * 60 * 1000
          });

          return reply("🔑 This is a protected command.\nUsage: .srcimg 0000");
        }
      }

      // If authenticated but no query
      if (!query) return reply("❌ Give search query.");

      await react("⏳");

      // ✅ Correct API call
      const apiUrl = `https://api.srihub.store/nsfw/xnxxsearch?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;
      console.log(`Searching srcimg: ${apiUrl}`);
      const { data } = await axios.get(apiUrl, { timeout: 30000 });
      console.log('API Response:', JSON.stringify(data));

      if (!data?.success || !data.result || (Array.isArray(data.result) && data.result.length === 0)) {
        await react("❌");
        const status = data?.status || "Unknown";
        const msg = data?.message || "No results found.";
        return reply(`❌ API Error or No Results.\nStatus: ${status}\nMessage: ${msg}`);
      }

      // Take first 5 results (adjustable)
      const results = data.result.slice(0, 5);

      let text = `🎬 *Search Results*\n\n`;

      results.forEach((res, i) => {
        text += `*${i + 1}.* ${res.title || 'No Title'}\n`;
        text += `⏱ Duration: ${res.duration || 'N/A'}\n`;
        text += `🔗 ${res.link || 'No Link'}\n\n`;
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