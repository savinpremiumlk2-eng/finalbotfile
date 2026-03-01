/**
 * YouTube Auto Search & Download (Fixed for Qasim API)
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

      // 🔎 SEARCH FIRST RESULT
      const searchRes = await axios.get(SEARCH_API, {
        timeout: 30000,
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

      // ⬇️ DOWNLOAD VIDEO (360p)
      const downloadRes = await axios.get(DOWNLOAD_API, {
        timeout: 60000,
        params: {
          apiKey: API_KEY,
          url: video.url,
          format: 360
        }
      });

      if (!downloadRes.data?.success || !downloadRes.data?.data?.download) {
        await react("❌");
        return reply("❌ Download failed.");
      }

      const fileUrl = downloadRes.data.data.download;

      await sock.sendMessage(from, {
        video: { url: fileUrl },
        caption: `🎬 *${downloadRes.data.data.title}*
👤 ${downloadRes.data.data.author}
⏱ ${downloadRes.data.data.duration}
👁 ${downloadRes.data.data.views}
📺 360p

> 💫 INFINITY MD`
      }, { quoted: msg });

      await react("✅");

    } catch (err) {
      console.log(err.response?.data || err.message);
      await react("❌");
      reply("❌ Error while processing request.");
    }
  }
};
