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
      if (q.includes('tiktok.com') || q.includes('vt.tiktok')) {
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
          
          // Fallback to a direct download API if others fail
          if (!videoUrl) {
             const fbRes = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(q)}`).catch(() => null);
             if (fbRes?.data?.data?.url) videoUrl = fbRes.data.data.url;
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
          const results = await APIs.tiktokSearch(q);
          if (results && results.length > 0) {
            const topResults = results.slice(0, 5);
            let message = `╭───〔 🔍 TIKTOK SEARCH 〕───\n│ 💬 *Results for*: ${q}\n╰────────────────────\n\n`;
            
            for (let i = 0; i < topResults.length; i++) {
              const res = topResults[i];
              message += `*${i + 1}.* ${res.title || 'No Title'}\n`;
              message += `👤 *Author*: ${res.author?.unique_id || 'Unknown'}\n`;
              message += `📥 *Download*: .tiktok ${res.play}\n\n`;
            }
            
            message += `> 💫 *INFINITY MD SEARCH*`;
            
            await sock.sendMessage(from, {
              image: { url: topResults[0].cover || 'https://i.ibb.co/L8G6pTz/tiktok.jpg' },
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
