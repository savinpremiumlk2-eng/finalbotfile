/**
 * Infinity MD - Film Downloader (Cinesubz)
 * Fully Updated Stable Version
 */

const axios = require('axios');

const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

// Simple in-memory session store
const sessions = new Map();

function resolveNumberReply(chatId, sender, text) {
  const t = String(text || '').trim();
  if (!/^\d{1}$/.test(t)) return null;
  const s = sessions.get(sender);
  if (!s) return null;
  return `.film2_download ${t}`;
}

module.exports = {
  name: 'film2',
  _filmReply: { resolveNumberReply },
  aliases: ['film', 'cinesubz'],
  category: 'movies',
  description: 'Download movies from Cinesubz',
  usage: '.film2 <movie name>',

  async execute(sock, msg, args, context = {}) {
    try {
      const chatId = context.from || msg.key.remoteJid;
      const sender = context.sender || msg.key.participant || msg.key.remoteJid;
      const commandName = context.commandName || 'film2';
      const text = args.join(' ').trim();

      // ================================
      // STEP 1: HANDLE REPLY SELECTION
      // ================================
      if (commandName === 'film2_download') {
        const session = sessions.get(sender);
        if (!session) return;

        const choice = parseInt(args[0]);

        if (![1, 2, 3].includes(choice)) {
          return await sock.sendMessage(chatId, {
            text: '❌ Reply with 1, 2 or 3.'
          }, { quoted: msg });
        }

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
        // FETCH DOWNLOAD OPTIONS
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

        // Flatten download links
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
        // AUTO QUALITY PICK (720p > 1080p > others)
        // ================================
        let picked =
          flatLinks.find(l => l.quality.includes('720')) ||
          flatLinks.find(l => l.quality.includes('1080')) ||
          flatLinks[0];

        await sock.sendMessage(chatId, {
          text: `⬇️ Selected: ${picked.quality}\n\n📦 Downloading movie...`
        }, { quoted: msg });

        // ================================
        // DOWNLOAD FILE (ARRAYBUFFER FIRST)
        // ================================
        let buffer;
        let downloadSuccess = false;

        try {
          const response = await axios.get(picked.url, {
            responseType: 'arraybuffer',
            timeout: 300000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: s => s >= 200 && s < 400
          });

          buffer = Buffer.from(response.data);

          if (buffer && buffer.length > 10000) {
            downloadSuccess = true;
          }
        } catch (err) {
          // Try stream fallback
          try {
            const response = await axios.get(picked.url, {
              responseType: 'stream',
              timeout: 300000,
              validateStatus: s => s >= 200 && s < 400
            });

            const chunks = [];
            await new Promise((resolve, reject) => {
              response.data.on('data', c => chunks.push(c));
              response.data.on('end', resolve);
              response.data.on('error', reject);
            });

            buffer = Buffer.concat(chunks);

            if (buffer && buffer.length > 10000) {
              downloadSuccess = true;
            }
          } catch (e) {
            downloadSuccess = false;
          }
        }

        sessions.delete(sender);

        if (!downloadSuccess) {
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
      if (!text) {
        return await sock.sendMessage(chatId, {
          text: 'Usage: .film2 <movie name>'
        }, { quoted: msg });
      }

      await sock.sendMessage(chatId, {
        text: '🔎 Searching movies (Top 3)...'
      }, { quoted: msg });

      const searchUrl =
        `https://api.srihub.store/movie/cinesubz?q=${encodeURIComponent(text)}&apikey=${API_KEY}`;

      const res = await axios.get(searchUrl, { timeout: 25000 });
      const results = res.data?.result;

      if (!results || !results.length) {
        return await sock.sendMessage(chatId, {
          text: '❌ No results found.'
        }, { quoted: msg });
      }

      const top3 = results.slice(0, 3);

      let messageText =
        `🎬 *Search Results for:* ${text}\n\nReply with 1 / 2 / 3 to download\n\n`;

      top3.forEach((item, i) => {
        messageText += `*${i + 1}.* ${item.title}\n`;
      });

      await sock.sendMessage(chatId, {
        text: messageText
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
