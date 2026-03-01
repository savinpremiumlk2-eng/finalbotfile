/**
 * Sinhanada Search & Direct Send - Srihub Only
 */

const axios = require('axios');

module.exports = {
  name: 'sinhanada',
  aliases: ['sinhanada', 'sn'],
  category: 'media',
  description: 'Search Sinhanada and send mp3 file',
  usage: '.sinhanada <song name>',

  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;

    const API_KEY = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';

    try {
      const query = args.join(" ").trim();
      if (!query) return reply("❌ Give song name.");

      await react("⏳");

      const apiUrl = `https://api.srihub.store/search/sinhanada?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;

      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data.success || !data.result || data.result.length === 0) {
        await react("❌");
        return reply("❌ No results found.");
      }

      const song = data.result[0]; // take first result

      if (!song.link) {
        await react("❌");
        return reply("❌ Song link missing from API.");
      }

      // If the link is an HTML page, we need to fetch the actual file link
      let downloadUrl = song.link;
      if (downloadUrl.includes('sinhanada.net')) {
        try {
          const pageRes = await axios.get(downloadUrl, { 
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          // Look for direct download link patterns
          const downloadMatch = pageRes.data.match(/href="(https:\/\/sinhanada\.net\/download\/[^"]+)"/) || 
                               pageRes.data.match(/href='(https:\/\/sinhanada\.net\/download\/[^']+)'/) ||
                               pageRes.data.match(/window\.location\.href\s*=\s*"(https:\/\/sinhanada\.net\/download\/[^"]+)"/);
          
          if (downloadMatch && downloadMatch[1]) {
            downloadUrl = downloadMatch[1];
          } else {
            // Fallback: look for any .mp3 link in the page
            const mp3Match = pageRes.data.match(/href="(https:\/\/[^"]+\.mp3)"/);
            if (mp3Match) downloadUrl = mp3Match[1];
          }
        } catch (e) {
          console.log("Error fetching sinhanada download page:", e.message);
        }
      }

      await sock.sendMessage(from, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mp4',
        ptt: true,
        caption: `🎵 *${song.title || "Sinhanada Song"}*
📦 Size: ${song.size || "Unknown"}

> INFINITY MD`
      }, { quoted: msg });

      await react("✅");

    } catch (err) {
      console.log(err.response?.data || err.message);
      await react("❌");
      reply("❌ API Error. Check console.");
    }
  }
};