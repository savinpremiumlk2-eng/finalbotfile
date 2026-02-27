/**
 * TikTok Search & Direct Send - Srihub Only
 */

const axios = require('axios');

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttsearch'],
  category: 'media',
  description: 'Search TikTok and send video',
  usage: '.tiktok <search query>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;

    const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

    try {
      const query = args.join(" ").trim();
      if (!query) return reply("❌ Give search text.");

      await react("⏳");

      const apiUrl = `https://api.srihub.store/search/tiktok?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;

      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data.success || !data.result || data.result.length === 0) {
        await react("❌");
        return reply("❌ No results found.");
      }

      const video = data.result[0]; // take first result

      if (!video.play && !video.url) {
        await react("❌");
        return reply("❌ Video URL missing from API.");
      }

      const videoUrl = video.play || video.url;

      await sock.sendMessage(from, {
        video: { url: videoUrl },
        caption: `🎬 *${video.title || "TikTok Video"}*
👤 ${video.author?.unique_id || "Unknown"}

> INFINITY MD`
      }, { quoted: msg });

      await react("✅");

    } catch (err) {
      console.log(err.response?.data || err.message);
      await react("❌");
      reply("❌ API Error. Check console.");
    }
  }
};