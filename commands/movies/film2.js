/**
 * FILM2 / Cinesubz Auto-Send (NO LINKS • ALWAYS TRY SEND FILE)
 * ------------------------------------------------------------
 * ✅ .film2 <name> -> shows ONLY 3 results
 * ✅ reply 1 / 2 / 3 -> bot auto picks quality and AUTO sends the FILE
 * ✅ FIX: resolves landing pages -> direct media URL
 * ✅ NO LINKS EVER
 * ✅ No hard size blocks (WhatsApp may still reject big uploads)
 *
 * NOTE:
 * - Uses in-memory session Map (no DB/store needed, avoids store bugs)
 * - Fixes file-type ESM issue via dynamic import
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');

const SRIHUB_API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

// ---- in-memory sessions: key = chatId|senderId ----
const SESSIONS = new Map(); // { listMsgId, query, items, createdAt, timeout }

function norm(s = '') {
  return String(s).toLowerCase().replace(/[\W_]+/g, ' ').trim();
}

function safeFileName(name, fallback = 'movie') {
  const base = String(name || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return base || fallback;
}

async function readChunk(file, len = 16384) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(file, { start: 0, end: len - 1 });
    const chunks = [];
    rs.on('data', c => chunks.push(c));
    rs.on('end', () => resolve(Buffer.concat(chunks)));
    rs.on('error', reject);
  });
}

// ---------- landing-page -> direct media resolver ----------
function isProbablyHtml(ctype, clen) {
  const ct = (ctype || '').toLowerCase();
  const len = Number(clen || 0);
  if (ct.includes('text/html')) return true;
  if (ct.includes('text/plain')) return true;
  if (!ct && len > 0 && len < 300000) return true;
  return false;
}

function extractDirectMediaUrl(html, baseUrl) {
  const mediaMatch = html.match(/https?:\/\/[^'"\s>]+\.(?:mp4|mkv|webm)(\?[^'"\s>]*)?/gi);
  if (mediaMatch?.length) return mediaMatch[0];

  const $ = cheerio.load(html);

  const source =
    $('video source[src]').attr('src') ||
    $('video[src]').attr('src') ||
    $('a[href$=".mp4"]').attr('href') ||
    $('a[href$=".mkv"]').attr('href') ||
    $('a[href$=".webm"]').attr('href');

  if (source) return new URL(source, baseUrl).toString();
  return null;
}

function pickNextPageUrl(html, baseUrl) {
  const $ = cheerio.load(html);

  const candidates = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const txt = norm($(el).text());
    const cls = norm($(el).attr('class') || '');
    const id = norm($(el).attr('id') || '');

    if (
      txt.includes('go to download') ||
      txt.includes('download page') ||
      txt === 'download' ||
      txt.includes('download') ||
      cls.includes('download') ||
      id.includes('download') ||
      href.toLowerCase().includes('download')
    ) {
      candidates.push(href);
    }
  });

  const onclick =
    $('a[onclick*="location"]').attr('onclick') ||
    $('button[onclick*="location"]').attr('onclick') ||
    '';
  if (onclick) {
    const m = onclick.match(/['"](https?:\/\/[^'"]+|\/[^'"]+)['"]/i);
    if (m?.[1]) candidates.unshift(m[1]);
  }

  const dataHref =
    $('a[data-href]').attr('data-href') ||
    $('button[data-href]').attr('data-href') ||
    '';
  if (dataHref) candidates.unshift(dataHref);

  const href = candidates.find(Boolean);
  if (!href) return null;

  return new URL(href, baseUrl).toString();
}

async function probeStream(url, referer) {
  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: 30000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
      'Referer': referer || 'https://cinesubz.lk'
    },
    validateStatus: () => true
  });
  return res;
}

async function resolveToDirectUrl(startUrl, referer, maxHops = 7) {
  let url = startUrl;

  for (let hop = 0; hop < maxHops; hop++) {
    const res = await probeStream(url, referer);
    const ctype = res.headers?.['content-type'] || '';
    const clen = res.headers?.['content-length'] || '0';
    const ct = ctype.toLowerCase();

    if (
      ct.includes('video/') ||
      ct.includes('application/octet-stream') ||
      ct.includes('application/x-matroska') ||
      ct.includes('binary') ||
      ct.includes('application/vnd')
    ) {
      res.data.destroy();
      return url;
    }

    if (isProbablyHtml(ctype, clen)) {
      res.data.destroy();

      const textRes = await axios.get(url, {
        responseType: 'text',
        timeout: 30000,
        maxRedirects: 10,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
          'Referer': referer || 'https://cinesubz.lk'
        }
      });

      const html = textRes.data || '';

      const direct = extractDirectMediaUrl(html, url);
      if (direct) {
        url = direct;
        continue;
      }

      const next = pickNextPageUrl(html, url);
      if (next) {
        url = next;
        continue;
      }

      throw new Error('Landing page detected but no direct media or download link found');
    }

    res.data.destroy();
    return url;
  }

  throw new Error('Could not resolve direct media URL (too many hops)');
}

// ---------- download to temp ----------
async function downloadToTemp(mediaUrl, referer) {
  const tmpFile = path.join(
    os.tmpdir(),
    `film2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );

  const res = await axios.get(mediaUrl, {
    responseType: 'stream',
    timeout: 12 * 60 * 1000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
      'Referer': referer || 'https://cinesubz.lk'
    }
  });

  const writer = fs.createWriteStream(tmpFile);

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    res.data.on('error', reject);
    writer.on('error', reject);
    writer.on('finish', resolve);
  });

  const stats = fs.statSync(tmpFile);
  if (stats.size < 8000) {
    try { fs.unlinkSync(tmpFile); } catch {}
    throw new Error('Downloaded file too small / not a real media file');
  }

  return { tmpFile, size: stats.size, contentType: res.headers?.['content-type'] || '' };
}

// ---------- pick default quality ----------
function parseQScore(quality = '', sizeStr = '') {
  const q = String(quality).toLowerCase();
  let s = 0;
  if (q.includes('720')) s += 60;
  else if (q.includes('1080')) s += 55;
  else if (q.includes('480')) s += 45;
  else if (q.includes('360')) s += 35;
  else s += 20;

  const st = (quality + ' ' + sizeStr).toLowerCase();
  if (st.includes('webrip')) s += 3;
  if (st.includes('bluray') || st.includes('blu-ray')) s += 3;

  const m = String(sizeStr).match(/([\d.]+)\s*(gb|mb)/i);
  if (m) {
    const v = Number(m[1]);
    const unit = (m[2] || '').toLowerCase();
    const mb = unit === 'gb' ? v * 1024 : v;
    if (mb > 2500) s -= 20;
    else if (mb > 1500) s -= 10;
  }

  return s;
}

function pickDefaultDownload(flatLinks) {
  const ranked = flatLinks
    .map(l => ({ l, s: parseQScore(l.quality, l.size) }))
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.l || null;
}

// ---------- plugin ----------
module.exports = {
  command: 'film2',
  aliases: ['cinesubz', 'cinesub'],
  category: 'movies',
  description: 'FILM2 (Cinesubz): top 3 -> reply 1/2/3 -> resolve -> download -> send file (NO links).',
  usage: '.film2 <movie name>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid; // works in groups too
    const query = args.join(' ').trim();
    const sessionKey = `${chatId}|${senderId}`;

    // ESM-safe import for file-type
    const { fileTypeFromBuffer } = await import('file-type');

    async function clearSession() {
      const s = SESSIONS.get(sessionKey);
      if (s?.timeout) clearTimeout(s.timeout);
      SESSIONS.delete(sessionKey);
    }

    try {
      if (!query) {
        return await sock.sendMessage(
          chatId,
          { text: '*Please provide a movie name.*\nExample: .film2 Ne Zha' },
          { quoted: message }
        );
      }

      await sock.sendMessage(chatId, { text: '🔎 Searching (top 3)...' }, { quoted: message });

      const searchUrl = `https://api.srihub.store/movie/cinesubz?q=${encodeURIComponent(query)}&apikey=${SRIHUB_API_KEY}`;
      const res = await axios.get(searchUrl, { timeout: 25000 });

      let results = res.data?.result;
      if (!Array.isArray(results) || results.length === 0) {
        return await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
      }

      results = results.slice(0, 3);

      let caption =
        `🎬 *Top 3 for:* *${query}*\n\n` +
        `↩️ *Reply with 1 / 2 / 3 to download*\n\n`;

      results.forEach((item, i) => {
        caption += `*${i + 1}.* ${item.title}\n`;
        if (item.quality) caption += `🎞️ Quality: ${item.quality}\n`;
        if (item.imdb) caption += `⭐ IMDB: ${item.imdb}\n`;
        caption += `\n`;
      });

      const firstImg = results[0]?.image;
      const sentListMsg = await sock.sendMessage(
        chatId,
        firstImg ? { image: { url: firstImg }, caption } : { text: caption },
        { quoted: message }
      );

      // store session (in memory)
      await clearSession();
      const timeout = setTimeout(async () => {
        await clearSession();
        try {
          await sock.sendMessage(chatId, { text: '⌛ Selection expired. Run .film2 again.' }, { quoted: sentListMsg });
        } catch {}
      }, 5 * 60 * 1000);

      SESSIONS.set(sessionKey, {
        listMsgId: sentListMsg.key.id,
        query,
        items: results.map(r => ({ title: r.title, link: r.link })),
        createdAt: Date.now(),
        timeout
      });

      // listener (single-use)
      const listener = async ({ messages }) => {
        const m = messages?.[0];
        if (!m?.message || m.key.remoteJid !== chatId) return;
        if (m.key.fromMe) return;

        const ctx = m.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId) return;

        const session = SESSIONS.get(sessionKey);
        if (!session?.listMsgId) return;

        // must reply to the exact list message
        if (ctx.stanzaId !== session.listMsgId) return;

        const replyText = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim();
        const choice = parseInt(replyText, 10);
        if (![1, 2, 3].includes(choice)) {
          return await sock.sendMessage(chatId, { text: '❌ Reply only with 1, 2, or 3.' }, { quoted: m });
        }

        const selected = session.items[choice - 1];
        if (!selected) return await sock.sendMessage(chatId, { text: '❌ Invalid selection.' }, { quoted: m });

        // stop further replies for this session
        sock.ev.off('messages.upsert', listener);

        await sock.sendMessage(chatId, { text: `ℹ️ Getting download options for *${selected.title}*...` }, { quoted: m });

        const detailsUrl = `https://api.srihub.store/movie/cinesubzdl?url=${encodeURIComponent(selected.link)}&apikey=${SRIHUB_API_KEY}`;
        const dlRes = await axios.get(detailsUrl, { timeout: 25000 });
        const movie = dlRes.data?.result;

        if (!movie) {
          await clearSession();
          return await sock.sendMessage(chatId, { text: '❌ Failed to fetch download details.' }, { quoted: m });
        }

        const flatLinks = [];
        if (Array.isArray(movie.downloadOptions) && movie.downloadOptions.length > 0) {
          movie.downloadOptions.forEach(opt => {
            (opt.links || []).forEach(link => {
              if (!link?.url) return;
              flatLinks.push({
                url: link.url,
                quality: link.quality || 'N/A',
                size: link.size || '',
                server: opt.serverTitle || opt.server || ''
              });
            });
          });
        } else if (movie.sourceUrl) {
          flatLinks.push({ url: movie.sourceUrl, quality: 'N/A', size: '', server: '' });
        }

        if (!flatLinks.length) {
          await clearSession();
          return await sock.sendMessage(chatId, { text: '❌ No downloadable files found.' }, { quoted: m });
        }

        const picked = pickDefaultDownload(flatLinks);
        if (!picked?.url) {
          await clearSession();
          return await sock.sendMessage(chatId, { text: '❌ Could not pick a download option.' }, { quoted: m });
        }

        await sock.sendMessage(
          chatId,
          { text: `⬇️ Default selected: *${picked.quality}* ${picked.size ? `(${picked.size})` : ''}\n📥 Resolving direct file...` },
          { quoted: m }
        );

        try {
          const directUrl = await resolveToDirectUrl(picked.url, selected.link, 7);

          await sock.sendMessage(chatId, { text: '📦 Downloading movie file...' }, { quoted: m });
          const dl = await downloadToTemp(directUrl, selected.link);

          const headBuf = await readChunk(dl.tmpFile, 16384);
          const type = await fileTypeFromBuffer(headBuf);

          const title = safeFileName(movie.title || selected.title || session.query, 'movie');
          const qTag = safeFileName(picked.quality || 'default', 'default').replace(/\s+/g, '');
          const ext = type?.ext || 'mp4';
          const fileName = `${title}_${qTag}.${ext}`;

          await sock.sendMessage(
            chatId,
            {
              document: fs.createReadStream(dl.tmpFile),
              mimetype: type?.mime || 'application/octet-stream',
              fileName,
              caption:
                `🎬 ${movie.title || selected.title}\n` +
                `✅ Quality: ${picked.quality}\n` +
                (picked.size ? `📦 Size: ${picked.size}` : '')
            },
            { quoted: m }
          );

          try { fs.unlinkSync(dl.tmpFile); } catch {}
          await clearSession();
        } catch (e) {
          await clearSession();
          const msg = String(e?.message || e || 'Unknown error');

          return await sock.sendMessage(
            chatId,
            {
              text:
                `❌ *Failed to send the movie file.*\n` +
                `Reason: ${msg.slice(0, 220)}\n\n` +
                `Tip: Some servers block bots or WhatsApp may reject very large files.`
            },
            { quoted: m }
          );
        }
      };

      sock.ev.on('messages.upsert', listener);
    } catch (err) {
      console.error('❌ FILM2 Error:', err?.message || err);
      try { await sock.sendMessage(chatId, { text: '❌ Failed. Check logs / try again.' }, { quoted: message }); } catch {}
    }
  }
};
