/**
 * TikTok Downloader & Search - Download TikTok videos
 */

const axios = require('axios');
const APIs = require('../../utils/api');

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
      const apiKey = 'dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi';
      
      if (!q) {
        return await reply(`╭───〔 📥 TIKTOK DL & SEARCH 〕───\n│ ❌ Please provide a TikTok link or search query.\n╰────────────────────`);
      }
      
      await react('⏳');
      
      // If it's a link, download directly
      if (q.includes('tiktok.com') || q.includes('vt.tiktok') || q.includes('tikwm.com')) {
        let videoUrl = q;
        let title = 'TikTok Video';

        // If it's not a direct link yet, try to get one
        if (!q.includes('tikwm.com/video/media/play')) {
           try {
             const res = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(q)}`);
             if (res.data?.data?.url || res.data?.data?.video_url) {
               videoUrl = res.data.data.url || res.data.data.video_url;
               title = res.data.data.metadata?.title || 'TikTok Video';
             }
           } catch (e) {
             // Fallback to existing API utility
             const result = await APIs.getTikTokDownload(q).catch(() => null);
             if (result) {
               videoUrl = result.videoUrl;
               title = result.title;
             }
           }
        }

        if (videoUrl) {
          await sock.sendMessage(from, {
            video: { url: videoUrl },
            caption: `╭───〔 📥 TIKTOK DL 〕───\n│ 📝 *Title*: ${title}\n│ ✅ *Success*\n╰────────────────────\n\n> 💫 *INFINITY MD DOWNLOADER*`
          }, { quoted: msg });
          await react('✅');
        } else {
          await reply(`╭───〔 📥 TIKTOK DL 〕───\n│ ❌ Failed to download video.\n╰────────────────────`);
        }
      } else {
        // It's a search query - Only use the requested Srihub endpoint
        try {
          const searchUrl = `https://api.srihub.store/search/tiktok?q=${encodeURIComponent(q)}&apikey=${apiKey}`;
          const response = await axios.get(searchUrl, { timeout: 25000 });
          
          if (response.data && response.data.success && response.data.result && response.data.result.length > 0) {
            const results = response.data.result.slice(0, 5);
            let message = `╭───〔 🔍 TIKTOK SEARCH 〕───\n│ 💬 *Results for*: ${q}\n╰────────────────────\n\n`;
            
            for (let i = 0; i < results.length; i++) {
              const res = results[i];
              message += `*${i + 1}.* ${res.title || 'No Title'}\n`;
              message += `👤 *Author*: ${res.author?.unique_id || 'Unknown'}\n`;
              message += `📥 *Download*: .tiktok ${res.play}\n\n`;
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
          await reply(`╭───〔 🔍 TIKTOK SEARCH 〕───\n│ ❌ Search Error: ${error.message}\n╰────────────────────`);
        }
      }
    } catch (error) {
      await reply(`❌ Error: ${error.message}`);
    }
  }
};
