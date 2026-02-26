/**
 * Infinity MD - Film Downloader (Cinesubz)
 * PREFIX SELECTION VERSION
 *
 * Usage:
 * .film2 <movie name>
 * .film2 1
 * .film2 2
 * .film2 3
 */

const axios = require('axios');

const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

// In-memory session store
const sessions = new Map();

module.exports = {
  name: 'film2',
  aliases: ['film', 'cinesubz'],
  category: 'movies',
  description: 'Download movies from Cinesubz',
  usage: '.film2 <movie name> OR .film2 1',

  async execute(sock, msg, args, context = {}) {
    try {
      const chatId = context.from || msg.key.remoteJid;
      const sender =
        context.sender ||
        msg.key.participant ||
        msg.key.remoteJid;

      const input = args.join(' ').trim();

      // ================================
      // STEP 1: HANDLE NUMBER SELECTION
      // ================================
      if (/^[1-3]$/.test(input)) {
        const session = sessions.get(sender);
        if (!session) {
          return await sock.sendMessage(chatId, {
            text: '❌ No active search found.\nUse .film2 <movie name> first.'
          }, { quoted: msg });
        }

        const choice = parseInt(input);
        const selected = session.results[choice - 1];

        if (!selected) {
          return await sock.sendMessage(chatId, {
            text: '❌ Invalid selection.'
          }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
          text: `🎬 *${selected.title}*\n\n📥 Fetching download options...`
        }, { quoted: msg });

        // ================================
        // FETCH DOWNLOAD DETAILS
        // ================================
        const detailsUrl =
          `https://api.srihub.store/movie/cinesubzdl?url=${encodeURIComponent(selected.link)}&apikey=${API_KEY}`;

        const dlRes = await axios.get(detailsUrl, { timeout: 25000 });
        const movie = dlRes.data?.result;

        if (!movie) {
          sessions.delete(sender);
          return await sock.sendMessage(chatId, {
            text: '❌ Failed to fetch download details.'
          }, { quoted: msg });
        }

        // Flatten links
        const flatLinks = [];

        if (Array.isArray(movie.downloadOptions)) {
          movie.downloadOptions.forEach(opt => {
            opt.links?.forEach(link => {
              if (link?.url) {
                flatLinks.push({
                  url: link.url,
                  quality: link.quality || 'Unknown'
                });
              }
            });
          });
        }

        if (!flatLinks.length) {
          sessions.delete(sender);
          return await sock.sendMessage(chatId, {
            text: '❌ No downloadable files found.'
          }, { quoted: msg });
        }

        // ================================
        // AUTO QUALITY PICK
        // 720p > 1080p > first available
        // ================================
        let picked =
          flatLinks.find(l => l.quality.includes('720')) ||
          flatLinks.find(l => l.quality.includes('1080')) ||
          flatLinks[0];

        await sock.sendMessage(chatId, {
          text: `⬇️ Selected Quality: ${picked.quality}\n\n📦 Downloading movie...`
        }, { quoted: msg });

        // ================================
        // DOWNLOAD FILE
        // ================================
        let buffer;
        let success = false;

        try {
          const response = await axios.get(picked.url, {
            responseType: 'arraybuffer',
            timeout: 300000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: s => s >= 200 && s < 400
          });

          buffer = Buffer.from(response.data);

          if (buffer.length > 10000) success = true;

        } catch (err) {
          success = false;
        }

        sessions.delete(sender);

        if (!success) {
          return await sock.sendMessage(chatId, {
            text: '❌ Failed to download movie file.\nServer may block large files.'
          }, { quoted: msg });
        }

        // ================================
        // SEND MOVIE
        // ================================
        await sock.sendMessage(chatId, {
          document: buffer,
          mimetype: 'video/mp4',
          fileName: `${selected.title.replace(/[^\w\s]/gi, '')}.mp4`,
          caption: `🎬 ${selected.title}\n\n> INFINITY MD`
        }, { quoted: msg });

        return;
      }

      // ================================
      // STEP 2: SEARCH MOVIE
      // ================================
      if (!input) {
        return await sock.sendMessage(chatId, {
          text: 'Usage:\n.film2 <movie name>\nThen use: .film2 1'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        text: '🔎 Searching movies (Top 3)...'
      }, { quoted: msg });

      const searchUrl =
        `https://api.srihub.store/movie/cinesubz?q=${encodeURIComponent(input)}&apikey=${API_KEY}`;

      const res = await axios.get(searchUrl, { timeout: 25000 });
      const results = res.data?.result;

      if (!results || !results.length) {
        return await sock.sendMessage(chatId, {
          text: '❌ No results found.'
        }, { quoted: msg });
      }

      const top3 = results.slice(0, 3);

      let textMsg =
        `🎬 *Search Results for:* ${input}\n\n`;
      textMsg += `Reply using:\n`;
      textMsg += `.film2 1\n.film2 2\n.film2 3\n\n`;

      top3.forEach((item, i) => {
        textMsg += `*${i + 1}.* ${item.title}\n`;
      });

      await sock.sendMessage(chatId, {
        text: textMsg
      }, { quoted: msg });

      sessions.set(sender, { results: top3 });

    } catch (err) {
      console.error('Film2 error:', err);

      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Failed to process request.'
      }, { quoted: msg });
    }
  }
};
