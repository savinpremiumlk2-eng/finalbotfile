/**
 * YouTube Search & Download
 * Searches YouTube, shows results as buttons, downloads on pick
 */

const axios = require('axios');
const yts = require('yt-search');
const APIs = require('../../utils/api');
const { sendBtn, btn } = require('../../utils/sendBtn');

// Store pending search results per sender (expires after 5 minutes)
const pendingSearches = new Map();
const PENDING_TTL = 5 * 60 * 1000;

function storePending(senderJid, videos) {
  pendingSearches.set(senderJid, { videos, ts: Date.now() });
}

function getPending(senderJid) {
  const entry = pendingSearches.get(senderJid);
  if (!entry) return null;
  if (Date.now() - entry.ts > PENDING_TTL) {
    pendingSearches.delete(senderJid);
    return null;
  }
  return entry.videos;
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*'
    }
  });
  return Buffer.from(res.data);
}

module.exports = {
  name: 'yt',
  aliases: ['youtube', 'ytsearch'],
  category: 'media',
  description: 'Search YouTube and download video',
  usage: '.yt <search query>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    try {
      // Handle selection: .yt pick <index>
      if (args[0] === 'pick') {
        const index = parseInt(args[1], 10);
        const videos = getPending(sender);
        if (!videos || isNaN(index) || index < 0 || index >= videos.length) {
          return reply('❌ Selection expired or invalid. Search again with .yt <query>');
        }

        const video = videos[index];
        const videoUrl = video.url;
        const videoTitle = video.title || 'YouTube Video';
        const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
        const thumb = video.thumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null);

        await react('⏳');

        // Send thumbnail with downloading notice
        if (thumb) {
          try {
            await sock.sendMessage(chatId, {
              image: { url: thumb },
              caption: `🎬 *${videoTitle}*\n⏳ _Downloading..._\n\n> 💫 *INFINITY MD*`
            }, { quoted: msg });
          } catch (e) {}
        }

        // Step 1: Get download URL from API chain
        let downloadUrl = null;
        let finalTitle = videoTitle;

        try {
          const result = await APIs.getEliteProTechVideoByUrl(videoUrl);
          downloadUrl = result?.download;
          finalTitle = result?.title || videoTitle;
          console.log('[YT] EliteProTech OK:', downloadUrl?.substring(0, 60));
        } catch (e1) {
          console.log('[YT] EliteProTech FAIL:', e1.message);
        }

        if (!downloadUrl) {
          try {
            const result = await APIs.getYupraVideoByUrl(videoUrl);
            downloadUrl = result?.download;
            finalTitle = result?.title || videoTitle;
            console.log('[YT] Yupra OK:', downloadUrl?.substring(0, 60));
          } catch (e2) {
            console.log('[YT] Yupra FAIL:', e2.message);
          }
        }

        if (!downloadUrl) {
          try {
            const result = await APIs.getOkatsuVideoByUrl(videoUrl);
            downloadUrl = result?.download;
            finalTitle = result?.title || videoTitle;
            console.log('[YT] Okatsu OK:', downloadUrl?.substring(0, 60));
          } catch (e3) {
            console.log('[YT] Okatsu FAIL:', e3.message);
          }
        }

        if (!downloadUrl) {
          await react('❌');
          return reply('❌ Failed to get download link. Please try again later.');
        }

        // Step 2: Download file as buffer and send
        console.log('[YT] Downloading buffer from:', downloadUrl.substring(0, 60));
        let videoBuffer;
        try {
          videoBuffer = await downloadBuffer(downloadUrl);
          console.log('[YT] Buffer size:', videoBuffer.length);
        } catch (bufErr) {
          console.log('[YT] Buffer download FAIL:', bufErr.message);
          await react('❌');
          return reply('❌ Failed to download video file. Please try again.');
        }

        const safeTitle = finalTitle.replace(/[^\w\s-]/g, '').trim() || 'video';
        await sock.sendMessage(chatId, {
          video: videoBuffer,
          mimetype: 'video/mp4',
          fileName: `${safeTitle}.mp4`,
          caption: `🎬 *${finalTitle}*\n\n> 💫 *INFINITY MD*`
        }, { quoted: msg });

        await react('✅');
        return;
      }

      // Normal search flow
      const query = args.join(' ').trim();
      if (!query) return reply('❌ Please provide a search query.\n\nUsage: .yt <search query>');

      await react('⏳');

      const { videos } = await yts(query);
      if (!videos || videos.length === 0) {
        await react('❌');
        return reply('❌ No YouTube videos found for that search.');
      }

      const results = videos.slice(0, 5);
      storePending(sender, results);

      const buttons = results.map((v, i) => {
        const label = (v.title || `Video ${i + 1}`).substring(0, 50);
        return btn(`yt_pick_${i}`, `${i + 1}. ${label}`);
      });

      await react('✅');

      await sendBtn(sock, from, {
        title: '🎬 YouTube Search Results',
        text:
          `🔍 *Query:* ${query}\n` +
          `📊 Found *${results.length}* videos\n\n` +
          `👇 Tap a title to download it:`,
        footer: `♾️ Infinity MD • Results expire in 5 min`,
        buttons,
      }, { quoted: msg });

    } catch (err) {
      console.error('[YT] Error:', err?.message || err);
      await react('❌');
      reply('❌ Failed. Please try again later.');
    }
  }
};
