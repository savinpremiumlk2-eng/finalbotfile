const axios = require('axios');

module.exports = {
  name: 'ytmp4',
  aliases: ['ytvideo2', 'ytv2'],
  category: 'media',
  description: 'Download YouTube video as MP4',
  usage: '.ytmp4 <youtube URL>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;

    try {
      const url = args[0]?.trim();
      if (!url) {
        return await sock.sendMessage(chatId, {
          text: '❌ Please provide a YouTube URL.\n\nUsage: .ytmp4 <youtube URL>'
        }, { quoted: msg });
      }

      const ytRegex = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/;
      if (!ytRegex.test(url)) {
        return await sock.sendMessage(chatId, {
          text: '❌ Invalid YouTube URL.'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        react: { text: '⏳', key: msg.key }
      });

      await sock.sendMessage(chatId, {
        text: '🎬 _Downloading video from YouTube..._'
      }, { quoted: msg });

      let downloadUrl, title;

      try {
        const apiRes = await axios.get(`https://api.qasimdev.dpdns.org/api/youtube/download`, {
          timeout: 60000,
          params: { apiKey: 'qasim-dev', url, format: 360 }
        });
        if (apiRes.data?.success && apiRes.data?.data?.download) {
          downloadUrl = apiRes.data.data.download;
          title = apiRes.data.data.title || 'video';
        }
      } catch (e) {}

      if (!downloadUrl) {
        try {
          const apiUrl = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`;
          const response = await axios.get(apiUrl, { timeout: 60000 });
          if (response.data?.data?.dl) {
            downloadUrl = response.data.data.dl;
            title = response.data.data.title || 'video';
          }
        } catch (e) {}
      }

      if (!downloadUrl) {
        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
        return await sock.sendMessage(chatId, {
          text: '❌ Failed to download video.'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        video: { url: downloadUrl },
        mimetype: 'video/mp4',
        fileName: `${(title || 'video').replace(/[^\w\s-]/g, '')}.mp4`,
        caption: `🎬 *${title || 'Video'}*\n\n> 💫 *INFINITY MD*`
      }, { quoted: msg });

      await sock.sendMessage(chatId, {
        react: { text: '✅', key: msg.key }
      });

    } catch (error) {
      console.error('[YTMP4] Error:', error?.message || error);
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
      await sock.sendMessage(chatId, {
        text: '❌ Download failed: ' + (error?.message || 'Unknown error')
      }, { quoted: msg });
    }
  }
};
