// FINAL FILM2 (WORKS WITHOUT GLOBAL onText HOOK)
// ---------------------------------------------
// ✔ Replies work even if your bot has no global reply dispatcher
// ✔ Uses temporary listener per command (like your old working version)
// ✔ Fixes store path, sender detection, and link detection
// ✔ Still tries to download file directly

const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Use absolute path so it NEVER breaks
const store = require(path.join(process.cwd(), 'lib', 'lightweight_store'));

const API_KEY = process.env.SRIHUB_APIKEY || 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';
const SEARCH_ENDPOINT = 'https://api.srihub.store/movie/cinesubz';
const DETAILS_ENDPOINT = 'https://api.srihub.store/movie/cinesubzdl';

function pickItemLink(item) {
  return (
    item?.link ||
    item?.url ||
    item?.pageUrl ||
    item?.permalink ||
    item?.href ||
    null
  );
}

async function downloadTemp(url, referer) {
  const tmp = path.join(os.tmpdir(), `film_${Date.now()}.mp4`);

  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: 10 * 60 * 1000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: referer || 'https://cinesubz.lk'
    }
  });

  const writer = fs.createWriteStream(tmp);

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return tmp;
}

module.exports = {
  name: 'film2',
  aliases: ['cinesubz'],
  category: 'movies',
  description: 'Search and auto send movie file',
  usage: '.film2 <movie name>',

  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    const senderId = msg.key.participant || msg.key.remoteJid;
    const query = args.join(' ').trim();

    let listener;
    let timer;

    async function cleanup() {
      try { if (listener) sock.ev.off('messages.upsert', listener); } catch {}
      try { if (timer) clearTimeout(timer); } catch {}
    }

    try {
      if (!query) {
        return extra.reply('❌ Provide movie name. Example: .film2 Avatar');
      }

      await extra.react('🔎');

      const res = await axios.get(
        `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&apikey=${API_KEY}`,
        { timeout: 25000 }
      );

      let results = res.data?.result || [];
      if (!Array.isArray(results) || !results.length) {
        return extra.reply('❌ No results found.');
      }

      results = results.slice(0, 5).map(r => ({
        title: r.title || 'Unknown',
        link: pickItemLink(r),
        image: r.image
      })).filter(x => x.link);

      if (!results.length) return extra.reply('❌ API returned results but no links found.');

      let text = `🎬 *Results for:* ${query}\n\nReply with number:\n\n`;
      results.forEach((r, i) => text += `*${i+1}.* ${r.title}\n`);

      const sent = await sock.sendMessage(chatId, { text }, { quoted: msg });

      // expire after 3 mins
      timer = setTimeout(async () => {
        await cleanup();
        sock.sendMessage(chatId, { text: '⌛ Selection expired. Run command again.' }, { quoted: sent });
      }, 180000);

      listener = async ({ messages }) => {
        const m = messages?.[0];
        if (!m?.message) return;
        if (m.key.remoteJid !== chatId) return;

        const ctx = m.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId || ctx.stanzaId !== sent.key.id) return;

        const reply = (
          m.message.conversation ||
          m.message.extendedTextMessage?.text ||
          ''
        ).trim();

        const num = parseInt(reply, 10);
        if (!num || num < 1 || num > results.length) {
          return sock.sendMessage(chatId, { text: '❌ Reply with valid number.' }, { quoted: m });
        }

        const chosen = results[num-1];

        await sock.sendMessage(chatId, { text: `⏬ Fetching *${chosen.title}*...` }, { quoted: m });

        try {
          const dlRes = await axios.get(
            `${DETAILS_ENDPOINT}?url=${encodeURIComponent(chosen.link)}&apikey=${API_KEY}`,
            { timeout: 25000 }
          );

          const movie = dlRes.data?.result;
          if (!movie) throw new Error('No download details');

          const links = [];

          if (Array.isArray(movie.downloadOptions)) {
            movie.downloadOptions.forEach(opt => {
              (opt.links || []).forEach(l => {
                if (l?.url) links.push(l.url);
              });
            });
          }

          if (!links.length && movie.sourceUrl) links.push(movie.sourceUrl);
          if (!links.length) throw new Error('No file links found');

          const fileUrl = links[0];

          await sock.sendMessage(chatId, { text: '📦 Downloading file...' }, { quoted: m });

          const tmp = await downloadTemp(fileUrl, chosen.link);

          await sock.sendMessage(
            chatId,
            {
              document: fs.createReadStream(tmp),
              fileName: `${chosen.title}.mp4`,
              mimetype: 'video/mp4'
            },
            { quoted: m }
          );

          try { fs.unlinkSync(tmp); } catch {}
          await cleanup();
        } catch (e) {
          await cleanup();
          sock.sendMessage(chatId, {
            text: `❌ Failed to send movie file.\nReason: ${String(e.message).slice(0,200)}`
          }, { quoted: m });
        }
      };

      sock.ev.on('messages.upsert', listener);

    } catch (e) {
      console.error('[film2 final] error:', e);
      await cleanup();
      extra.reply('❌ Error processing request.');
    }
  }
};
