/**
 * YouTube Search & Direct Download (No Selection)
 */

const axios = require('axios');

module.exports = {
  name: 'yt',
  aliases: ['youtube', 'ytdl', 'ytmp4'],
  category: 'media',
  description: 'Search YouTube and auto download first result',
  usage: '.yt <search query>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;

    const API_KEY = 'qasim-dev';
    const SEARCH_API = 'https://api.qasimdev.dpdns.org/api/yts/searchVideos';
    const DOWNLOAD_API = 'https://api.qasimdev.dpdns.org/api/youtube/download';

    try {
      const query = args.join(" ").trim();
      if (!query) return reply("❌ Give search text.");

      await react("⏳");

      // 🔎 SEARCH
      const searchRes = await axios.get(SEARCH_API, {
        timeout: 25000,
        params: {
          apiKey: API_KEY,
          query,
          limit: 1
        }
      });

      if (!searchRes.data?.success || !searchRes.data?.data?.videos?.length) {
        await react("❌");
        return reply("❌ No results found.");
      }

      const video = searchRes.data.data.videos[0];

      // ⬇️ DOWNLOAD FIRST RESULT
      const downloadRes = await axios.get(DOWNLOAD_API, {
        timeout: 60000,
        params: {
          apiKey: API_KEY,
          url: video.url,
          format: 'mp4'
        }
      });

      if (!downloadRes.data?.success || !downloadRes.data?.data?.downloadUrl) {
        await react("❌");
        return reply("❌ Download API failed.");
      }

      const downloadUrl = downloadRes.data.data.downloadUrl;

      await sock.sendMessage(from, {
        video: { url: downloadUrl },
        caption: `🎬 *${video.title || "YouTube Video"}*
⏱ ${video?.duration?.timestamp || "N/A"}
👁 ${formatViews(video?.views)} views

> 💫 INFINITY MD`
      }, { quoted: msg });

      await react("✅");

    } catch (err) {
      console.log(err.response?.data || err.message);
      await react("❌");
      reply("❌ Error while processing.");
    }
  }
};

// 👁 View Formatter
function formatViews(views) {
  if (!views) return "0";
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + "M";
  if (views >= 1_000) return (views / 1_000).toFixed(1) + "K";
  return views.toString();
}
