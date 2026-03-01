const axios = require('axios');
const config = require('../../config');

const API_KEY = 'qasim-dev';
const SEARCH_API = 'https://api.qasimdev.dpdns.org/api/yts/searchVideos';
const DOWNLOAD_API = 'https://api.qasimdev.dpdns.org/api/youtube/download';

const SESSIONS = new Map();

function formatViews(n) {
  const num = Number(n || 0);
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

module.exports = {
  command: 'yt',
  aliases: ['yts', 'ytsearch'],
  category: 'media',
  description: 'Search YouTube and send direct video.',
  usage: '.yt <keyword>',

  async handler(sock, message, args, context = {}) {

    const chatId = context.chatId || message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    const text = (message.message?.conversation ||
                 message.message?.extendedTextMessage?.text || '').trim();

    const sessionKey = `${chatId}|${senderId}`;

    const sendText = (textMsg) =>
      sock.sendMessage(chatId, { text: textMsg }, { quoted: message });

    // ==========================================
    // ✅ NUMBER REPLY DETECTION (NO PREFIX NEEDED)
    // ==========================================
    if (/^[1-5]$/.test(text)) {
      const session = SESSIONS.get(sessionKey);
      if (!session) return;

      const choice = parseInt(text);
      const selected = session.videos[choice - 1];
      if (!selected) return;

      SESSIONS.delete(sessionKey);

      await sendText('⬇️ Downloading video...');

      try {
        const downloadRes = await axios.get(DOWNLOAD_API, {
          timeout: 60000,
          params: {
            apiKey: API_KEY,
            url: selected.url,
            format: 'mp4'
          }
        });

        if (!downloadRes.data?.success || !downloadRes.data?.data?.downloadUrl) {
          return sendText('❌ Download API failed.');
        }

        const videoUrl = downloadRes.data.data.downloadUrl;

        return await sock.sendMessage(chatId, {
          video: { url: videoUrl },
          caption:
            `🎬 *${selected.title}*\n` +
            `👤 ${selected?.author?.name || 'Unknown'}\n` +
            `⏱ ${selected?.duration?.timestamp || 'N/A'}\n\n` +
            `> INFINITY MD`
        }, { quoted: message });

      } catch (err) {
        console.error(err.message);
        return sendText('❌ Download failed.');
      }
    }

    // ==========================================
    // 🔎 NORMAL SEARCH PART
    // ==========================================

    const query = args.join(' ').trim();
    if (!query) return;

    try {

      await sendText('🔎 Searching YouTube...');

      const res = await axios.get(SEARCH_API, {
        timeout: 25000,
        params: {
          apiKey: API_KEY,
          query,
          limit: 10
        }
      });

      if (!res.data?.success) {
        return sendText('❌ API search failed.');
      }

      const videos = res.data?.data?.videos;
      if (!Array.isArray(videos) || videos.length === 0) {
        return sendText('❌ No results found.');
      }

      const top = videos.slice(0, 5);

      let caption =
        `🎥 *YouTube Results*\n` +
        `🔎 *Query:* ${query}\n\n` +
        `↩️ Reply *1-5* (no prefix needed)\n\n`;

      top.forEach((v, i) => {
        caption += `*${i + 1}.* ${v.title}\n`;
        caption += `⏱ ${v?.duration?.timestamp || 'N/A'}\n`;
        caption += `👁 ${formatViews(v?.views)} views\n\n`;
      });

      const thumb = top[0]?.thumbnail;

      await sock.sendMessage(
        chatId,
        thumb ? { image: { url: thumb }, caption } : { text: caption },
        { quoted: message }
      );

      SESSIONS.set(sessionKey, { videos: top });

      setTimeout(() => SESSIONS.delete(sessionKey), 5 * 60 * 1000);

    } catch (err) {
      console.error(err.message);
      return sendText('❌ Error while searching.');
    }
  }
};
