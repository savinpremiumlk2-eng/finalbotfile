/**
 * TikTok Downloader & Search - Download TikTok videos
 */

const { ttdl } = require('ruhend-scraper');
const axios = require('axios');
const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl', 'ttsearch', 'tiktoksearch'],
  category: 'media',
  description: 'Download TikTok videos or search for them',
  usage: '.tiktok <TikTok URL or Search Query>',
  
  async execute(sock, msg, args, extra) {
    const { from, reply, react } = extra;
    try {
      const q = args.join(" ");
      
      if (!q) {
        return await reply(`╭───〔 📥 TIKTOK DL & SEARCH 〕───\n│ ❌ Please provide a TikTok link or search query.\n╰────────────────────`);
      }
      
      await react('⏳');
      
      // If it's a link, download directly
      if (q.includes('tiktok.com')) {
        try {
          let videoUrl = null;
          let title = null;
          
          const result = await APIs.getTikTokDownload(q).catch(() => null);
          if (result) {
            videoUrl = result.videoUrl;
            title = result.title;
          }
          
          if (!videoUrl) {
            const downloadData = await ttdl(q).catch(() => null);
            if (downloadData && downloadData.data && downloadData.data.length > 0) {
              videoUrl = downloadData.data[0].url;
            }
          }
          
          if (videoUrl) {
            await sock.sendMessage(from, {
              video: { url: videoUrl },
              caption: `╭───〔 📥 TIKTOK DL 〕───\n${title ? `│ 📝 *Title*: ${title}\n` : ''}│ ✅ *Success*\n╰────────────────────\n\n> 💫 *INFINITY MD DOWNLOADER*`
            }, { quoted: msg });
            await react('✅');
          } else {
            await reply(`╭───〔 📥 TIKTOK DL 〕───\n│ ❌ Failed to download video.\n╰────────────────────`);
          }
        } catch (error) {
          await reply(`╭───〔 📥 TIKTOK DL 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
        }
      } else {
        // It's a search query
        try {
          const searchRes = await axios.get(`https://api.siputzx.my.id/api/s/tiktok?query=${encodeURIComponent(q)}`);
          if (searchRes.data && searchRes.data.status && searchRes.data.data && searchRes.data.data.length > 0) {
            const results = searchRes.data.data.slice(0, 5);
            let message = `╭───〔 🔍 TIKTOK SEARCH 〕───\n│ 💬 *Results for*: ${q}\n╰────────────────────\n\n`;
            
            for (let i = 0; i < results.length; i++) {
              message += `*${i + 1}.* ${results[i].title || 'No Title'}\n`;
              message += `👤 *Author*: ${results[i].author?.nickname || 'Unknown'}\n`;
              message += `🔗 *URL*: ${results[i].url}\n\n`;
            }
            
            message += `> 💫 *INFINITY MD SEARCH*`;
            
            await sock.sendMessage(from, {
              image: { url: results[0].cover || 'https://i.ibb.co/L8G6pTz/tiktok.jpg' },
              caption: message
            }, { quoted: msg });
            await react('✅');
          } else {
            await reply(`╭───〔 🔍 TIKTOK SEARCH 〕───\n│ ❌ No results found for "${q}".\n╰────────────────────`);
          }
        } catch (error) {
          await reply(`╭───〔 🔍 TIKTOK SEARCH 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
        }
      }
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  }
};
