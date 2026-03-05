/**
 * XNXX Downloader
 */

const axios = require("axios");

module.exports = {
  name: "src-dl",
  category: "media",
  description: "Download XNXX video",
  usage: ".src-dl <xnxx url>",

  async execute(sock, msg, args, extra) {

    const { from, sender, reply, react } = extra;
    const API_KEY = "dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi";

    try {

      const store = require('../../lib/lightweight_store');

      const systemEnabled = await store.getSetting('system', 'src_commands_enabled');
      if (systemEnabled === false) {
        return reply("❌ SRC commands are currently disabled by the owner.");
      }

      const database = require('../../database');
      const globalSettings = await database.getGlobalSettings();
      const sessionSettings = sock._customConfig?.settings || {};
      const isPublic = sessionSettings.srcMode === 'public' || (globalSettings.srcMode === 'public' && !sessionSettings.srcMode);

      const sessionKey = `srcimg_pass_${from}_${sender}`;
      const session = await store.getSetting('sessions', sessionKey);

      if (!isPublic && (!session || !session.authed)) {
        return reply("🔑 Login first using .srcimg 0000");
      }

      const videoUrl = args.join(" ").trim();
      if (!videoUrl) return reply("❌ Provide XNXX video link.");

      await react("⏳");

      const api =
`https://api.srihub.store/nsfw/xnxxdl?url=${encodeURIComponent(videoUrl)}&apikey=${API_KEY}`;

      const res = await axios.get(api, { timeout: 30000 });

      if (!res.data || !res.data.status || !res.data.results) {
        await react("❌");
        return reply("❌ Failed to fetch video.");
      }

      const v = res.data.results;

      const video =
        v.files?.high ||
        v.files?.low;

      if (!video) {
        await react("❌");
        return reply("❌ Video file not found.");
      }

      await sock.sendMessage(
        from,
        {
          video: { url: video },
          caption:
`🎬 *${v.title}*

👤 Author : ${v.author}
⭐ Rating : ${v.rating}
👍 Likes : ${v.likes}

⏱ Duration : ${Math.floor(v.duration / 60)} min`
        },
        { quoted: msg }
      );

      await react("✅");

    } catch (err) {

      console.log("XNXX DOWNLOAD ERROR:", err.response?.data || err.message);

      await react("❌");
      reply("❌ Download API error.");

    }

  }
};