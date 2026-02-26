const axios = require('axios');
const config = require('../../config');

// ✅ API inside plugin (as you requested)
const API_KEY = 'qasim-dev';
const API_URL = 'https://api.qasimdev.dpdns.org/api/yts/searchVideos';

// in-memory sessions
const SESSIONS = new Map();

function formatViews(n) {
  const num = Number(n || 0);
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

function resolveNumberReply(chatId, sender, text) {
  const t = String(text || '').trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const sessionKey = `${chatId}|${sender}`;
  const s = SESSIONS.get(sessionKey);
  if (!s) return null;
  return `.yt_download ${t}`;
}

module.exports = {
  command: 'yt',
  _ytReply: { resolveNumberReply },
  aliases: ['yts', 'ytsearch'],
  category: 'media',
  description: 'Search YouTube videos and pick one.',
  usage: '.yt <keyword>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    const query = args.join(' ').trim();
    const commandName = context.commandName || 'yt';

    const sendText = (text, quoted = message) =>
      sock.sendMessage(chatId, { text }, { quoted });

    async function clearSession(key) {
      const s = SESSIONS.get(key);
      if (s?.timeout) clearTimeout(s.timeout);
      SESSIONS.delete(key);
    }

    if (commandName === 'yt_download') {
      const sessionKey = `${chatId}|${senderId}`;
      const session = SESSIONS.get(sessionKey);
      if (!session) return;
      const choice = parseInt(args[0], 10);
      const v = session.videos[choice - 1];
      if (!v) return;
      
      await clearSession(sessionKey);
      const msg = `✅ *Selected Video*\n\n🎬 ${v.title}\n👤 ${v?.author?.name || 'Unknown'}\n⏱ ${v?.duration?.timestamp || 'N/A'}\n👁 ${formatViews(v?.views)} views\n\n${v.url}`;
      return sendText(msg);
    }

    if (query.startsWith(config.prefix)) return;
    const sessionKey = `${chatId}|${senderId}`;

    try {
      if (!query) {
        return await sendText('❌ Usage: .yt <search>\nExample: .yt mr beast');
      }

      await sendText('🔎 Searching YouTube...');

      const res = await axios.get(API_URL, {
        timeout: 25000,
        params: {
          apiKey: API_KEY,
          query,
          limit: 10
        },
        validateStatus: () => true
      });

      if (res.status !== 200 || !res.data?.success) {
        return await sendText('❌ API search failed.');
      }

      const videos = res.data?.data?.videos;
      if (!Array.isArray(videos) || videos.length === 0) {
        return await sendText('❌ No results found.');
      }

      const top = videos.slice(0, 5);

      let caption =
        `🎥 *YouTube Results*\n` +
        `🔎 *Query:* ${query}\n\n` +
        `↩️ Reply *1-5* to choose\n\n`;

      top.forEach((v, i) => {
        caption += `*${i + 1}.* ${v.title}\n`;
        caption += `⏱ ${v?.duration?.timestamp || 'N/A'}\n`;
        caption += `👤 ${v?.author?.name || 'Unknown'}\n`;
        caption += `👁 ${formatViews(v?.views)} views\n\n`;
      });

      const thumb = top[0]?.thumbnail;

      const listMsg = await sock.sendMessage(
        chatId,
        thumb ? { image: { url: thumb }, caption } : { text: caption },
        { quoted: message }
      );

      await clearSession(sessionKey);

      const timeout = setTimeout(async () => {
        await clearSession(sessionKey);
      }, 5 * 60 * 1000);

      SESSIONS.set(sessionKey, {
        listMsgId: listMsg.key.id,
        videos: top,
        timeout
      });

    } catch (err) {
      console.error('YT plugin error:', err?.message || err);
      return await sendText('❌ Error while searching.');
    }
  }
};
