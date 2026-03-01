/**
 * Infinity MD - Film Downloader (Cinesubz)
 * DIRECT STREAM VERSION (No Buffer Crash)
 */

const axios = require('axios');

const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';
const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1GB
const sessions = new Map();

module.exports = {
  name: 'film2',
  aliases: ['film', 'cinesubz'],
  category: 'movies',
  description: 'Download movies from Cinesubz',
  usage: '.film2 <movie name> OR reply with number',

  async execute(sock, msg, args, context = {}) {

    const chatId = context.from || msg.key.remoteJid;
    const sender =
      context.sender ||
      msg.key.participant ||
      msg.key.remoteJid;

    const input = args.join(' ').trim();

    try {

      // =====================================================
      // ✅ STEP 1 — NUMBER SELECTION
      // =====================================================
      if (sessions.has(sender) && /^\d+$/.test(input)) {

        const session = sessions.get(sender);
        const index = parseInt(input) - 1;
        const selected = session.results[index];

        if (!selected) {
          return sock.sendMessage(chatId, {
            text: `❌ Invalid selection. Choose 1-${session.results.length}`
          }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
          text: `🎬 *${selected.title || selected.name}*\n\n📥 Fetching download links...`
        }, { quoted: msg });

        const detailsUrl =
          `https://api.srihub.store/movie/cinesubzdl?url=${encodeURIComponent(selected.link || selected.url)}&apikey=${API_KEY}`;

        const dlRes = await axios.get(detailsUrl, { timeout: 30000 });
        const movie = dlRes.data?.result || dlRes.data?.data;

        if (!movie?.downloadOptions) {
          sessions.delete(sender);
          return sock.sendMessage(chatId, {
            text: '❌ Failed to fetch download details.'
          }, { quoted: msg });
        }

        // =============================
        // ✅ FLATTEN LINKS
        // =============================
        const links = [];

        movie.downloadOptions.forEach(opt => {
          opt.links?.forEach(l => {
            if (l?.url) {
              links.push({
                url: l.url,
                quality: l.quality || opt.quality || 'Unknown'
              });
            }
          });
        });

        if (!links.length) {
          sessions.delete(sender);
          return sock.sendMessage(chatId, {
            text: '❌ No downloadable files found.'
          }, { quoted: msg });
        }

        // Prefer 720p → 1080p → first
        let picked =
          links.find(l => l.quality.includes('720')) ||
          links.find(l => l.quality.includes('1080')) ||
          links[0];

        // Fix for google.com placeholder links from API
        if (picked.url.includes('google.com/server')) {
          const realLink = links.find(l => !l.url.includes('google.com'));
          if (realLink) {
            picked = realLink;
          } else {
             sessions.delete(sender);
             return sock.sendMessage(chatId, {
               text: `❌ The API provided a placeholder link (${picked.url}). No valid mirrors found.\n\n🎬 *${selected.title || 'Movie'}*`
             }, { quoted: msg });
          }
        }

        await sock.sendMessage(chatId, {
          text: `⬇️ Selected Quality: ${picked.quality}\n📦 Checking size...`
        }, { quoted: msg });

        // =============================
        // ✅ SIZE CHECK (NO DOWNLOAD)
        // =============================
        let fileSize = 0;

        try {
          const head = await axios.head(picked.url, { 
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          fileSize = parseInt(head.headers['content-length'] || 0);
        } catch {}

        if (fileSize && fileSize < 1000000) { // Less than 1MB is likely a fake/error page
           sessions.delete(sender);
           return sock.sendMessage(chatId, {
             text: `❌ The server returned a small file (${(fileSize / 1024).toFixed(1)} KB), which might be a fake or error page.\n\n📎 Try Direct Link:\n${picked.url}`
           }, { quoted: msg });
        }

        if (fileSize && fileSize > MAX_FILE_SIZE) {
          sessions.delete(sender);
          return sock.sendMessage(chatId, {
            text:
              `❌ File too large (${(fileSize / 1024 / 1024).toFixed(0)} MB)\n\n📎 Direct Link:\n${picked.url}`
          }, { quoted: msg });
        }

        sessions.delete(sender);

        // =============================
        // ✅ SEND DIRECT VIDEO URL
        // =============================
        try {

          await sock.sendMessage(chatId, {
            video: { url: picked.url },
            caption:
              `🎬 *${selected.title || 'Movie'}*\n` +
              `📀 Quality: ${picked.quality}\n\n` +
              `> INFINITY MD`
          }, { quoted: msg });

        } catch (err) {

          // fallback
          return sock.sendMessage(chatId, {
            text:
              `❌ WhatsApp blocked video.\n\n📎 Direct Link:\n${picked.url}`
          }, { quoted: msg });
        }

        return;
      }

      // =====================================================
      // ✅ STEP 2 — SEARCH
      // =====================================================
      if (!input) {
        return sock.sendMessage(chatId, {
          text: 'Usage:\n.film2 <movie name>\nThen reply with number.'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        text: '🔎 Searching movies...'
      }, { quoted: msg });

      const searchUrl =
        `https://api.srihub.store/movie/cinesubz?q=${encodeURIComponent(input)}&apikey=${API_KEY}`;

      const res = await axios.get(searchUrl, { timeout: 30000 });
      const results = res.data?.result || res.data?.data;

      if (!results?.length) {
        return sock.sendMessage(chatId, {
          text: '❌ No results found.'
        }, { quoted: msg });
      }

      const top = results.slice(0, 10);

      let text =
        `🎬 *Search Results for:* ${input}\n\nReply with number to download:\n\n`;

      top.forEach((item, i) => {
        text += `*${i + 1}.* ${item.title || item.name}\n`;
      });

      await sock.sendMessage(chatId, { text }, { quoted: msg });

      sessions.set(sender, { results: top });

    } catch (err) {
      console.error('Film2 Error:', err.response?.data || err.message);

      await sock.sendMessage(chatId, {
        text: '❌ Failed to process request.'
      }, { quoted: msg });
    }
  }
};