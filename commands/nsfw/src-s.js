/**
 * XNXX Search - Return First Video Link Only
 */

const axios = require("axios");

module.exports = {
  name: "src-s",
  category: "media",
  description: "Search XNXX and return first video link",
  usage: ".src-s <query>",

  async execute(sock, msg, args, extra) {
    const { from, sender, reply, react } = extra;
    const API_KEY = "dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi";

    try {
      const store = require('../../lib/lightweight_store');

      const systemEnabled = await store.getSetting('system', 'src_commands_enabled');
      if (!systemEnabled) return reply("❌ SRC commands are currently disabled by the owner.");

      const database = require('../../database');
      const globalSettings = await database.getGlobalSettings();
      const sessionSettings = sock._customConfig?.settings || {};
      const isPublic = sessionSettings.srcMode === 'public' || (globalSettings.srcMode === 'public' && !sessionSettings.srcMode);

      const sessionKey = `srcimg_pass_${from}_${sender}`;
      const session = await store.getSetting('sessions', sessionKey);
      if (!isPublic && (!session || !session.authed)) return reply("🔑 Login first using .srcimg 0000");

      const query = args.join(" ").trim();
      if (!query) return reply("❌ Give search text.\nExample: `.src-s milf`");

      await react("⏳");

      // API call
      const url = `https://api.srihub.store/nsfw/xnxxsearch?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;
      const res = await axios.get(url, { timeout: 30000 });

      const videos = res.data?.results?.result;

      if (!videos || videos.length === 0) {
        await react("❌");
        return reply("❌ No results found.");
      }

      const firstVideo = videos[0];
      if (!firstVideo?.link) {
        await react("❌");
        return reply("❌ Video link missing.");
      }

      await react("✅");

      return reply(`🔎 *Search:* ${query}\n\n🔗 ${firstVideo.link}`);

    } catch (err) {
      console.log("XNXX SEARCH ERROR:", err?.response?.data || err.message);
      await react("❌");
      return reply("❌ Search API error or API may be down.");
    }
  }
};