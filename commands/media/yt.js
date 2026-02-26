const axios = require('axios');

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

module.exports = {
  command: 'yt',
  aliases: ['yts', 'ytsearch'],
  category: 'media',
  description: 'Search YouTube videos and pick one.',
  usage: '.yt <keyword>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    const query = args.join(' ').trim();
    if (query.startsWith(config.prefix)) return; // prevent loop
    const sessionKey = `${chatId}|${senderId}`;

    const sendText = (text, quoted = message) =>
      sock.sendMessage(chatId, { text }, { quoted });

    async function clearSession() {
      const s = SESSIONS.get(sessionKey);
      if (s?.timeout) clearTimeout(s.timeout);
      SESSIONS.delete(sessionKey);
    }

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

      await clearSession();

      const timeout = setTimeout(async () => {
        await clearSession();
        try {
          await sendText('⌛ Selection expired. Run .yt again.', listMsg);
        } catch {}
      }, 5 * 60 * 1000);

      SESSIONS.set(sessionKey, {
        listMsgId: listMsg.key.id,
        videos: top,
        timeout
      });

      const listener = async ({ messages }) => {
        const m = messages?.[0];
        if (!m?.message) return;
        if (m.key.remoteJid !== chatId) return;
        if (m.key.fromMe) return;

        const ctx = m.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId) return;

        const session = SESSIONS.get(sessionKey);
        if (!session?.listMsgId) return;

        if (ctx.stanzaId !== session.listMsgId) return;

        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
        const choice = parseInt(text, 10);

        if (!choice || choice < 1 || choice > session.videos.length) {
          return await sendText('❌ Reply with a number 1-5.', m);
        }

        const v = session.videos[choice - 1];

        sock.ev.off('messages.upsert', listener);
        await clearSession();

        const msg =
          `✅ *Selected Video*\n\n` +
          `🎬 ${v.title}\n` +
          `👤 ${v?.author?.name || 'Unknown'}\n` +
          `⏱ ${v?.duration?.timestamp || 'N/A'}\n` +
          `👁 ${formatViews(v?.views)} views\n\n` +
          `${v.url}`;

        await sendText(msg, m);
      };

      sock.ev.on('messages.upsert', listener);

    } catch (err) {
      console.error('YT plugin error:', err?.message || err);
      return await sendText('❌ Error while searching.');
    }
  }
};
