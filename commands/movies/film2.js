/**
 * Cinesubz Auto-Send v2 (NO LINKS • ALWAYS TRY SEND FILE)
 * -------------------------------------------------------
 * ✅ .cinesubz <name> -> shows ONLY 3 results
 * ✅ Reply 1/2/3 -> bot auto-picks a default quality and AUTO sends the FILE
 * ✅ Uses ONE global reply handler (no listener stacking)
 * ✅ NO LINKS EVER (only file or error message)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { fromBuffer } = require('file-type');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');

const store = require('../lib/lightweight_store');

const SRIHUB_API_KEY = process.env.SRIHUB_APIKEY || 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';
const SEARCH_ENDPOINT = 'https://api.srihub.store/movie/cinesubz';
const DETAILS_ENDPOINT = 'https://api.srihub.store/movie/cinesubzdl';

const STORE_SCOPE = 'sessions';
const SESSION_TTL_MS = 5 * 60 * 1000;

function safeFileName(name, fallback = 'movie') {
  const base = String(name || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return base || fallback;
}

function pickItemLink(item) {
  return (
    item?.link ||
    item?.url ||
    item?.pageUrl ||
    item?.permalink ||
    item?.href ||
    item?.slug ||
    null
  );
}

async function dbSet(key, value) {
  if (typeof store.set === 'function') return store.set(STORE_SCOPE, key, value);
  if (typeof store.saveSetting === 'function') return store.saveSetting(STORE_SCOPE, key, value);
  if (typeof store.write === 'function') return store.write(STORE_SCOPE, key, value);
  throw new Error('lightweight_store missing set/saveSetting/write');
}

async function dbGet(key) {
  if (typeof store.get === 'function') return store.get(STORE_SCOPE, key);
  if (typeof store.getSetting === 'function') return store.getSetting(STORE_SCOPE, key);
  if (typeof store.read === 'function') return store.read(STORE_SCOPE, key);
  throw new Error('lightweight_store missing get/getSetting/read');
}

async function dbDel(key) {
  if (typeof store.del === 'function') return store.del(STORE_SCOPE, key);
  if (typeof store.delete === 'function') return store.delete(STORE_SCOPE, key);
  if (typeof store.remove === 'function') return store.remove(STORE_SCOPE, key);
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

// ---------- landing page -> direct media resolver ----------
function isProbablyHtml(ctype, clen) {
  const ct = (ctype || '').toLowerCase();
  const len = Number(clen || 0);
  if (ct.includes('text/html')) return true;
  if (ct.includes('text/plain')) return true;
  if (!ct && len > 0 && len < 300000) return true;
  return false;
}

function extractDirectMediaUrl(html, baseUrl) {
  // Look for direct file URLs in the HTML
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

  $('a[href],button[onclick],a[data-href],button[data-href]').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const href = tag === 'a' ? $(el).attr('href') : null;
    const dataHref = $(el).attr('data-href');
    const onclick = $(el).attr('onclick') || '';

    const txt = (($(el).text() || '') + ' ' + ($(el).attr('class') || '') + ' ' + ($(el).attr('id') || '')).toLowerCase();

    if (dataHref) candidates.push(dataHref);
    if (href) candidates.push(href);

    if (onclick.includes('location')) {
      const m = onclick.match(/['"](https?:\/\/[^'"]+|\/[^'"]+)['"]/i);
      if (m?.[1]) candidates.unshift(m[1]);
    }

    if (txt.includes('download')) candidates.unshift(href || dataHref);
  });

  const next = candidates.find(Boolean);
  if (!next) return null;
  return new URL(next, baseUrl).toString();
}

async function probeStream(url, referer) {
  return axios.get(url, {
    responseType: 'stream',
    timeout: 30000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
      'Referer': referer || 'https://cinesubz.lk',
      'Accept': '*/*'
    },
    validateStatus: () => true
  });
}

async function resolveToDirectUrl(startUrl, referer, maxHops = 7) {
  let url = startUrl;

  for (let hop = 0; hop < maxHops; hop++) {
    const res = await probeStream(url, referer);
    const ctype = res.headers?.['content-type'] || '';
    const clen = res.headers?.['content-length'] || '0';
    const ct = ctype.toLowerCase();

    // If response looks like media/file
    if (
      ct.includes('video/') ||
      ct.includes('application/octet-stream') ||
      ct.includes('application/x-matroska') ||
      ct.includes('binary')
    ) {
      res.data.destroy();
      return url;
    }

    // If looks like HTML, parse and hop
    if (isProbablyHtml(ctype, clen)) {
      res.data.destroy();

      const textRes = await axios.get(url, {
        responseType: 'text',
        timeout: 30000,
        maxRedirects: 10,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
          'Referer': referer || 'https://cinesubz.lk',
          'Accept': 'text/html,application/xhtml+xml'
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

      throw new Error('Landing page found but direct media could not be extracted');
    }

    // Unknown type: assume direct
    res.data.destroy();
    return url;
  }

  throw new Error('Could not resolve direct media URL (too many hops)');
}

// ---------- download to temp ----------
async function downloadToTemp(mediaUrl, referer) {
  const tmpFile = path.join(os.tmpdir(), `cinesubz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const res = await axios.get(mediaUrl, {
    responseType: 'stream',
    timeout: 12 * 60 * 1000,
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
      'Referer': referer || 'https://cinesubz.lk',
      'Accept': '*/*'
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
    throw new Error('Downloaded file too small (not a valid media file)');
  }

  return { tmpFile, size: stats.size, contentType: res.headers?.['content-type'] || '' };
}

// ---------- default quality picker ----------
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

function getTextFromMsg(m) {
  return (
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    ''
  ).trim();
}

function getReplyToId(m) {
  return m?.message?.extendedTextMessage?.contextInfo?.stanzaId || null;
}

// ---------- plugin ----------
module.exports = {
  command: 'cinesubz',
  aliases: ['cinesub'],
  category: 'movies',
  description: 'Cinesubz: top 3 -> reply 1/2/3 -> auto-download and send file (NO links).',
  usage: '.cinesubz <movie name>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    // IMPORTANT: correct sender for groups vs private
    const senderId = message.key.participant || message.key.remoteJid;

    const query = args.join(' ').trim();
    if (!query) {
      return sock.sendMessage(chatId, { text: '*Please provide a movie name.*\nExample: .cinesubz Ne Zha' }, { quoted: message });
    }

    const sessionKey = `cinesubz:${chatId}:${senderId}`;

    try {
      await sock.sendMessage(chatId, { text: '🔎 Searching Cinesubz (top 3)...' }, { quoted: message });

      const searchUrl = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&apikey=${encodeURIComponent(SRIHUB_API_KEY)}`;
      const res = await axios.get(searchUrl, { timeout: 25000 });

      let results = res.data?.result;
      if (!Array.isArray(results) || results.length === 0) {
        return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
      }

      results = results.slice(0, 3).map(r => ({
        title: r?.title || r?.name || 'Unknown title',
        quality: r?.quality || '',
        imdb: r?.imdb || '',
        image: r?.image || '',
        link: pickItemLink(r)
      })).filter(x => !!x.link);

      if (!results.length) {
        return sock.sendMessage(chatId, { text: '❌ Results found, but none had a valid link/url.' }, { quoted: message });
      }

      let caption =
        `🎬 *Cinesubz (Top ${results.length}) for:* *${query}*\n\n` +
        `↩️ *Reply with 1 / 2 / 3 to download*\n` +
        `⏳ Expires in 5 minutes\n\n`;

      results.forEach((item, i) => {
        caption += `*${i + 1}.* ${item.title}\n`;
        if (item.quality) caption += `🎞️ ${item.quality}\n`;
        if (item.imdb) caption += `⭐ IMDB: ${item.imdb}\n`;
        caption += `\n`;
      });

      const firstImg = results[0]?.image;
      const sentListMsg = await sock.sendMessage(
        chatId,
        firstImg ? { image: { url: firstImg }, caption } : { text: caption },
        { quoted: message }
      );

      await dbSet(sessionKey, {
        chatId,
        senderId,
        listMsgId: sentListMsg.key.id,
        createdAt: Date.now(),
        items: results.map(r => ({ title: r.title, link: r.link }))
      });

    } catch (err) {
      console.error('[cinesubz v2] command error:', err?.response?.data || err);
      await dbDel(sessionKey);
      return sock.sendMessage(chatId, { text: '❌ Failed to search right now. Try again later.' }, { quoted: message });
    }
  },

  // Global reply handler (call this from your messages.upsert)
  async onText(sock, m, context = {}) {
    const chatId = context.chatId || m.key.remoteJid;
    const senderId = m.key.participant || m.key.remoteJid;

    const sessionKey = `cinesubz:${chatId}:${senderId}`;

    const txt = getTextFromMsg(m);
    if (!/^(1|2|3)$/.test(txt)) return;

    const repliedTo = getReplyToId(m);
    if (!repliedTo) return;

    let session;
    try {
      session = await dbGet(sessionKey);
    } catch {
      return;
    }

    if (!session?.listMsgId) return;

    // Must be reply to our list message
    if (repliedTo !== session.listMsgId) return;

    // Expired
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      await dbDel(sessionKey);
      return sock.sendMessage(chatId, { text: '⌛ Selection expired. Please run the command again.' }, { quoted: m });
    }

    const choice = parseInt(txt, 10);
    const selected = session.items?.[choice - 1];
    if (!selected?.link) {
      await dbDel(sessionKey);
      return sock.sendMessage(chatId, { text: '❌ Invalid selection. Run .cinesubz again.' }, { quoted: m });
    }

    // Lock session to prevent double-taps
    if (session.busy) return;
    session.busy = true;
    await dbSet(sessionKey, session);

    try {
      await sock.sendMessage(chatId, { text: `ℹ️ Getting download options for *${selected.title}*...` }, { quoted: m });

      const detailsUrl = `${DETAILS_ENDPOINT}?url=${encodeURIComponent(selected.link)}&apikey=${encodeURIComponent(SRIHUB_API_KEY)}`;
      const dlRes = await axios.get(detailsUrl, { timeout: 25000 });
      const movie = dlRes.data?.result;

      if (!movie) throw new Error('Download details missing');

      // Flatten
      const flatLinks = [];
      if (Array.isArray(movie.downloadOptions) && movie.downloadOptions.length) {
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

      if (!flatLinks.length) throw new Error('No downloadable files found');

      const picked = pickDefaultDownload(flatLinks);
      if (!picked?.url) throw new Error('Could not pick a download option');

      await sock.sendMessage(chatId, { text: `⬇️ Selected: *${picked.quality}* ${picked.size ? `(${picked.size})` : ''}\n📥 Resolving direct file...` }, { quoted: m });

      const directUrl = await resolveToDirectUrl(picked.url, selected.link, 7);

      await sock.sendMessage(chatId, { text: '📦 Downloading movie file...' }, { quoted: m });
      const dl = await downloadToTemp(directUrl, selected.link);

      const headBuf = await readChunk(dl.tmpFile, 16384);
      const type = await fromBuffer(headBuf);

      const title = safeFileName(movie.title || selected.title, 'movie');
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
      await dbDel(sessionKey);

    } catch (e) {
      console.error('[cinesubz v2] download error:', e?.response?.data || e);

      // NO LINKS EVER
      await sock.sendMessage(
        chatId,
        {
          text:
            `❌ *Failed to send the movie file.*\n` +
            `Reason: ${(e?.message || String(e)).slice(0, 220)}\n\n` +
            `Tip: Server may block bots, or WhatsApp may reject large files.`
        },
        { quoted: m }
      );

      await dbDel(sessionKey);
    }
  }
};
