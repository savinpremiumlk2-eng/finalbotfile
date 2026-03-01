const axios = require('axios');
const config = require('../../config');

const API_KEY = 'qasim-dev';
const SEARCH_API = 'https://api.qasimdev.dpdns.org/api/yts/searchVideos';
const DOWNLOAD_API = 'https://api.qasimdev.dpdns.org/api/youtube/download';

// -------------------- Number reply session (in-memory) --------------------
const YT_SESSIONS = new Map();

function skey(chatId, sender) {
  return `${chatId}:${sender}`;
}

function resolveNumberReply(chatId, sender, text) {
  const t = String(text || '').trim();
  if (!/^[1-5]$/.test(t)) return null;

  const s = YT_SESSIONS.get(skey(chatId, sender));
  if (!s) return null;

  const video = s.videos[parseInt(t) - 1];
  if (!video) return null;

  return `.yt_download ${video.url}`;
}

module.exports._ytReply = { resolveNumberReply };

module.exports = {
  command: 'yt',
  aliases: ['yts', 'ytsearch', 'yt_download'],
  category: 'media',
  description: 'Search YouTube and send direct video.',
  usage: '.yt <keyword>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    const commandName = context.commandName || 'yt';

    const sendText = (textMsg) =>
      sock.sendMessage(chatId, { text: textMsg }, { quoted: message });

    // Handle the internal download command
    if (commandName === 'yt_download') {
      const videoUrl = args[0];
      if (!videoUrl) return;

      await sendText('⬇️ Downloading video...');
      try {
        const downloadRes = await axios.get(DOWNLOAD_API, {
          timeout: 60000,
          params: { apiKey: API_KEY, url: videoUrl, format: 'mp4' }
        });

        if (!downloadRes.data?.success || !downloadRes.data?.data?.downloadUrl) {
          return sendText('❌ Download API failed.');
        }

        return await sock.sendMessage(chatId, {
          video: { url: downloadRes.data.data.downloadUrl },
          caption: `> INFINITY MD`
        }, { quoted: message });
      } catch (err) {
        return sendText('❌ Download failed.');
      }
    }

    const query = args.join(' ').trim();
    if (!query) return;

    try {
      await sendText('🔎 Searching YouTube...');
      const res = await axios.get(SEARCH_API, {
        timeout: 25000,
        params: { apiKey: API_KEY, query, limit: 10 }
      });

      if (!res.data?.success) return sendText('❌ API search failed.');

      const videos = res.data?.data?.videos;
      if (!Array.isArray(videos) || videos.length === 0) return sendText('❌ No results found.');

      const top = videos.slice(0, 5);
      let caption = `🎥 *YouTube Results*\n🔎 *Query:* ${query}\n\n↩️ Reply *1-5* (no prefix needed)\n\n`;

      top.forEach((v, i) => {
        caption += `*${i + 1}.* ${v.title}\n⏱ ${v?.duration?.timestamp || 'N/A'}\n👁 ${formatViews(v?.views)} views\n\n`;
      });

      const thumb = top[0]?.thumbnail;
      await sock.sendMessage(chatId, thumb ? { image: { url: thumb }, caption } : { text: caption }, { quoted: message });

      YT_SESSIONS.set(skey(chatId, senderId), { videos: top });
      setTimeout(() => YT_SESSIONS.delete(skey(chatId, senderId)), 5 * 60 * 1000);
    } catch (err) {
      return sendText('❌ Error while searching.');
    }
  }
};
