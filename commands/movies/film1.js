const axios = require('axios');
const store = require('../../lib/lightweight_store');
const { fromBuffer } = require('file-type');
const cheerio = require('cheerio');
const { URL } = require('url');

const API_KEY = 'dew_kuKmHwBBCgIAdUty5TBY1VWWtUgwbQwKRtC8MFUF';
const SEARCH_ENDPOINT = 'https://api.srihub.store/movie/srihub';
const DL_ENDPOINT = 'https://api.srihub.store/movie/srihubdl';
const SESSION_TTL_MS = 10 * 60 * 1000;

function humanSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let u = -1;
  do { bytes /= thresh; ++u; } while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return `${bytes.toFixed(1)} ${units[u]}`;
}

module.exports = {
  name: 'film1',
  aliases: ['srihub'],
  category: 'movies',
  description: 'Search and download movies from SriHub',
  usage: '.film1 <movie name>',

  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    const senderId = extra.sender;
    const query = args.join(' ').trim();

    if (!query) return extra.reply('❌ Please provide a movie name.');

    try {
      await extra.react('🔎');
      const res = await axios.get(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&apikey=${API_KEY}`);
      const results = (res.data?.result?.data || res.data?.result || []).slice(0, 10);

      if (!results.length) return extra.reply('❌ No results found.');

      let text = `🎬 *SriHub Results for:* _${query}_\n\n`;
      results.forEach((item, i) => {
        text += `*${i + 1}.* ${item.title || item.name}\n`;
      });
      text += `\n*Reply with a number to download.*\n\n> *INFINITY MD*`;

      const sent = await sock.sendMessage(chatId, { text }, { quoted: msg });
      
      const sessionKey = `srihub_${chatId}_${senderId}`;
      await store.saveSetting('sessions', sessionKey, { 
        results: results.map(r => r.url || r.link),
        msgId: sent.key.id,
        timestamp: Date.now()
      });

    } catch (e) {
      extra.reply(`❌ Error: ${e.message}`);
    }
  }
};
