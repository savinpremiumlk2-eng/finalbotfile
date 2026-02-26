/**
 * Infinity MD - Film Downloader (Cinesubz)
 * STABLE VERSION - Large File Protection + Link Fallback
 *
 * Usage:
 * .film2 <movie name>
 * .film2 1
 * .film2 2
 * .film2 3
 */

const axios = require('axios');

const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

// Max file size allowed (1000MB = 1GB safety limit)
const MAX_FILE_SIZE = 1000 * 1024 * 1024;

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

      // =====================================================
      // STEP 1 — HANDLE SELECTION (.film2 1 / 2 / 3)
      // =====================================================
      if (/^[1-3]$/.test(input)) {
        const session = sessions.get(sender);
        if (!session) {
          return sock.sendMessage(chatId, {
            text: '❌ No active search.\nUse .film2 <movie name> first.'
          }, { quoted: msg });
        }

        const selected = session.results[parseInt(input) - 1];
        if (!selected) {
          return sock.sendMessage(chatId, {
            text: '❌ Invalid selection.'
          }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
          text: `🎬 *${selected.title}*\n\n📥 Fetching download links...`
        }, { quoted: msg });

        const detailsUrl =
          `https://api.srihub.store/movie/cinesubzdl?url=${encodeURIComponent(selected.link)}&apikey=${API_KEY}`;

        const dlRes = await axios.get(detailsUrl, { timeout: 25000 });
        const movie = dlRes.data?.result;

        if (!movie || !movie.downloadOptions) {
          sessions.delete(sender);
          return sock.sendMessage(chatId, {
            text: '❌ Failed to fetch download details.'
          }, { quoted: msg });
        }

        // Flatten links
        const flatLinks = [];
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

        if (!flatLinks.length) {
          sessions.delete(sender);
          return sock.sendMessage(chatId, {
            text: '❌ No downloadable files found.'
          }, { quoted: msg });
        }

        // Auto pick quality (720p > 1080p > first)
        const picked =
          flatLinks.find(l => l.quality.includes('720')) ||
          flatLinks.find(l => l.quality.includes('1080')) ||
          flatLinks[0];

        await sock.sendMessage(chatId, {
          text: `⬇️ Selected: ${picked.quality}\n\n📦 Checking file size...`
        }, { quoted: msg });

        // =====================================================
        // STEP 2 — CHECK FILE SIZE (HEAD REQUEST)
        // =====================================================
        let fileSize = 0;

        try {
          const head = await axios.head(picked.url, { timeout: 15000 });
          fileSize = parseInt(head.headers['content-length'] || 0);
        } catch {
          // Ignore if HEAD fails
        }

        if (fileSize && fileSize > MAX_FILE_SIZE) {
          sessions.delete(sender);
          return sock.sendMessage(chatId, {
            text:
              `❌ File too large (${(fileSize / 1024 / 1024).toFixed(0)} MB).\n\n` +
              `📎 Direct Download:\n${picked.url}`
          }, { quoted: msg });
        }

        // =====================================================
        // STEP 3 — DOWNLOAD FILE
        // =====================================================
        let buffer;
        let downloadSuccess = false;

        // Try arraybuffer first
        try {
          const response = await axios.get(picked.url, {
            responseType: 'arraybuffer',
            timeout: 300000,
            maxContentLength: MAX_FILE_SIZE,
            maxBodyLength: MAX_FILE_SIZE,
            validateStatus: s => s >= 200 && s < 400
          });

          buffer = Buffer.from(response.data);

          if (buffer.length > 10000) {
            downloadSuccess = true;
          }
        } catch {
          // Try stream fallback
          try {
            const response = await axios.get(picked.url, {
              responseType: 'stream',
              timeout: 300000,
              validateStatus: s => s >= 200 && s < 400
            });

            const chunks = [];
            let total = 0;

            await new Promise((resolve, reject) => {
              response.data.on('data', chunk => {
                total += chunk.length;
                if (total > MAX_FILE_SIZE) {
                  reject(new Error('File too large'));
                }
                chunks.push(chunk);
              });
              response.data.on('end', resolve);
              response.data.on('error', reject);
            });

            buffer = Buffer.concat(chunks);
            downloadSuccess = true;
          } catch {
            downloadSuccess = false;
          }
        }

        sessions.delete(sender);

        // =====================================================
        // STEP 4 — IF DOWNLOAD FAILED → SEND LINK
        // =====================================================
        if (!downloadSuccess || !buffer) {
          return sock.sendMessage(chatId, {
            text:
              `❌ Failed to send movie file.\n\n📎 Direct Download:\n${picked.url}`
          }, { quoted: msg });
        }

        // =====================================================
        // STEP 5 — SEND AS DOCUMENT
        // =====================================================
        try {
          await sock.sendMessage(chatId, {
            document: buffer,
            mimetype: 'video/mp4',
            fileName: `${selected.title.replace(/[^\w\s-]/g, '')}.mp4`,
            caption: `🎬 ${selected.title}\n\n> INFINITY MD`
          }, { quoted: msg });

        } catch (sendErr) {
          // If WhatsApp rejects large document
          return sock.sendMessage(chatId, {
            text:
              `❌ WhatsApp blocked large file.\n\n📎 Direct Download:\n${picked.url}`
          }, { quoted: msg });
        }

        return;
      }

      // =====================================================
      // STEP 6 — SEARCH MOVIE
      // =====================================================
      if (!input) {
        return sock.sendMessage(chatId, {
          text:
            'Usage:\n.film2 <movie name>\nThen use: .film2 1'
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
        return sock.sendMessage(chatId, {
          text: '❌ No results found.'
        }, { quoted: msg });
      }

      const top3 = results.slice(0, 3);

      let messageText =
        `🎬 *Search Results for:* ${input}\n\n` +
        `Reply using:\n.film2 1\n.film2 2\n.film2 3\n\n`;

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
