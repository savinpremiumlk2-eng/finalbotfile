/**
 * TikTok Downloader - Download TikTok videos
 */

const { ttdl } = require('ruhend-scraper');
const axios = require('axios');
const APIs = require('../../utils/api');
const config = require('../../config');

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'tiktokdl'],
  category: 'media',
  description: 'Download TikTok videos',
  usage: '.tiktok <TikTok URL>',
  
  async execute(sock, msg, args, extra) {
    try {
      const url = args[0];
      
      if (!url) {
        return await extra.reply(`╭───〔 📥 TIKTOK DL 〕───\n│ ❌ Please provide a TikTok link.\n╰────────────────────`);
      }
      
      await extra.react('⏳');
      
      try {
        let videoUrl = null;
        let title = null;
        
        const result = await APIs.getTikTokDownload(url).catch(() => null);
        if (result) {
          videoUrl = result.videoUrl;
          title = result.title;
        }
        
        if (!videoUrl) {
          const downloadData = await ttdl(url).catch(() => null);
          if (downloadData && downloadData.data && downloadData.data.length > 0) {
            videoUrl = downloadData.data[0].url;
          }
        }
        
        if (videoUrl) {
          await sock.sendMessage(extra.from, {
            video: { url: videoUrl },
            caption: `╭───〔 📥 TIKTOK DL 〕───\n${title ? `│ 📝 *Title*: ${title}\n` : ''}│ ✅ *Success*\n╰────────────────────\n\n> 💫 *INFINITY MD DOWNLOADER*`
          }, { quoted: msg });
          await extra.react('✅');
        } else {
          await extra.reply(`╭───〔 📥 TIKTOK DL 〕───\n│ ❌ Failed to download video.\n╰────────────────────`);
        }
      } catch (error) {
        await extra.reply(`╭───〔 📥 TIKTOK DL 〕───\n│ ❌ Error: ${error.message}\n╰────────────────────`);
      }
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
