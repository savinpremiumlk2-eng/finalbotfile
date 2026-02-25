const axios = require('axios');
const store = require('../../lib/lightweight_store');

const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';
const SEARCH_ENDPOINT = 'https://api.srihub.store/movie/cinesubz';

module.exports = {
  name: 'film2',
  aliases: ['cinesubz'],
  category: 'movies',
  description: 'Search and download movies from CineSubz',
  usage: '.film2 <movie name>',

  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    const senderId = extra.sender;
    const query = args.join(' ').trim();

    if (!query) return extra.reply('❌ Please provide a movie name.');

    try {
      await extra.react('🔎');
      const res = await axios.get(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&apikey=${API_KEY}`);
      const results = (res.data?.result || []).slice(0, 10);

      if (!results.length) return extra.reply('❌ No results found.');

      let text = `🎬 *CineSubz Results for:* _${query}_\n\n`;
      results.forEach((item, i) => {
        text += `*${i + 1}.* ${item.title}\n`;
      });
      text += `\n*Reply with a number to download.*\n\n> *INFINITY MD*`;

      const sent = await sock.sendMessage(chatId, { text }, { quoted: msg });
      
      const sessionKey = `cinesubz_${chatId}_${senderId}`;
      await store.saveSetting('sessions', sessionKey, { 
        results: results.map(r => r.link || r.url),
        msgId: sent.key.id,
        timestamp: Date.now()
      });

    } catch (e) {
      extra.reply(`❌ Error: ${e.message}`);
    }
  }
};
