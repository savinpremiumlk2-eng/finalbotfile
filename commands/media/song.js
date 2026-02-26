/**
 * Song Downloader - Download audio from YouTube
 */
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const APIs = require('../../utils/api');
const { toAudio } = require('../../utils/converter');

const AXIOS_DEFAULTS = {
  timeout: 60000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  }
};

// ← Put your working API key here
// Test first with: https://api.qasimdev.dpdns.org/api/youtube/download?apiKey=YOUR_KEY&url=https://youtu.be/dQw4w9WgXcQ&format=mp3
const QASIM_API_KEY = 'qasim-dev';  // ← CHANGE THIS if you have/obtain a real key

module.exports = {
  name: 'song',
  aliases: ['play', 'music', 'yta'],
  category: 'media',
  description: 'Download audio from YouTube',
  usage: '.song <song name or YouTube link>',

  async execute(sock, msg, args) {
    try {
      const text = args.join(' ');
      const chatId = msg.key.remoteJid;

      if (!text) {
        return await sock.sendMessage(chatId, {
          text: 'Usage: .song <song name or YouTube link>'
        }, { quoted: msg });
      }

      let video;

      if (text.includes('youtube.com') || text.includes('youtu.be')) {
        video = { url: text, title: 'YouTube Video', thumbnail: '', timestamp: '??:??' };
      } else {
        const search = await yts(text);
        if (!search || !search.videos.length) {
          return await sock.sendMessage(chatId, {
            text: 'No results found.'
          }, { quoted: msg });
        }
        video = search.videos[0];
      }

      // Show downloading message with thumbnail
      await sock.sendMessage(chatId, {
        image: { url: video.thumbnail },
        caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp || '??:??'}\n\n> *INFINITY MD*`
      }, { quoted: msg });

      let audioBuffer = null;
      let downloadSuccess = false;
      let usedSource = 'none';

      // ────────────────────────────────────────────────
      // 1. Try QasimDev API first
      // ────────────────────────────────────────────────
      if (QASIM_API_KEY) {
        try {
          console.log(`[QasimDev] Requesting: ${video.url}`);

          const qasimResponse = await axios.get('https://api.qasimdev.dpdns.org/api/youtube/download', {
            params: {
              apiKey: QASIM_API_KEY,
              url: video.url,
              format: 'mp3'
            },
            ...AXIOS_DEFAULTS,
            responseType: 'json',
            timeout: 45000
          });

          console.log('[QasimDev] Response:', JSON.stringify(qasimResponse.data, null, 2));

          const dlUrl = qasimResponse.data?.download 
                     || qasimResponse.data?.url 
                     || qasimResponse.data?.link 
                     || qasimResponse.data?.file;

          if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
            console.log(`[QasimDev] Downloading from: ${dlUrl}`);

            const audioRes = await axios.get(dlUrl, {
              responseType: 'arraybuffer',
              timeout: 120000,
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
              }
            });

            audioBuffer = Buffer.from(audioRes.data);

            if (audioBuffer && audioBuffer.length > 20000) {
              downloadSuccess = true;
              usedSource = 'QasimDev';
            }
          }
        } catch (qErr) {
          console.error('[QasimDev] Failed:', qErr.message, qErr.response?.status, qErr.response?.data?.error || '');
        }
      }

      // ────────────────────────────────────────────────
      // 2. Fallback to original APIs if QasimDev failed
      // ────────────────────────────────────────────────
      if (!downloadSuccess) {
        const apiMethods = [
          { name: 'EliteProTech', method: () => APIs.getEliteProTechDownloadByUrl(video.url) },
          { name: 'Yupra',        method: () => APIs.getYupraDownloadByUrl(video.url) },
          { name: 'Okatsu',       method: () => APIs.getOkatsuDownloadByUrl(video.url) },
          { name: 'Izumi',        method: () => APIs.getIzumiDownloadByUrl(video.url) }
        ];

        for (const api of apiMethods) {
          try {
            const data = await api.method();
            console.log(`${api.name} response:`, JSON.stringify(data, null, 2));

            const dlUrl = data.download || data.dl || data.url || data.link;

            if (!dlUrl || typeof dlUrl !== 'string' || !dlUrl.startsWith('http')) {
              continue;
            }

            const res = await axios.get(dlUrl, {
              responseType: 'arraybuffer',
              timeout: 90000,
              maxContentLength: Infinity,
              maxBodyLength: Infinity
            });

            audioBuffer = Buffer.from(res.data);

            if (audioBuffer && audioBuffer.length > 20000) {
              downloadSuccess = true;
              usedSource = api.name;
              break;
            }
          } catch (e) {
            console.log(`${api.name} failed: ${e.message}`);
          }
        }
      }

      if (!downloadSuccess || !audioBuffer || audioBuffer.length < 20000) {
        throw new Error('All download sources failed (including QasimDev). Video may be unavailable, blocked, or APIs are down.');
      }

      // ────────────────────────────────────────────────
      // Format detection + conversion (your original logic)
      // ────────────────────────────────────────────────
      const firstBytes = audioBuffer.slice(0, 12);
      const hexSignature = firstBytes.toString('hex');
      const asciiSignature = firstBytes.toString('ascii', 4, 8);

      let detectedFormat = 'unknown';
      let actualMimetype = 'audio/mpeg';
      let fileExtension = 'mp3';

      if (asciiSignature === 'ftyp' || hexSignature.startsWith('000000')) {
        const ftypBox = audioBuffer.slice(4, 8).toString('ascii');
        if (ftypBox === 'ftyp') {
          detectedFormat = 'M4A/MP4';
          actualMimetype = 'audio/mp4';
          fileExtension = 'm4a';
        }
      } else if (audioBuffer.toString('ascii', 0, 3) === 'ID3' ||
                 (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
        detectedFormat = 'MP3';
        actualMimetype = 'audio/mpeg';
        fileExtension = 'mp3';
      } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
        detectedFormat = 'OGG/Opus';
        actualMimetype = 'audio/ogg; codecs=opus';
        fileExtension = 'ogg';
      } else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
        detectedFormat = 'WAV';
        actualMimetype = 'audio/wav';
        fileExtension = 'wav';
      } else {
        actualMimetype = 'audio/mp4';
        fileExtension = 'm4a';
        detectedFormat = 'Unknown (defaulting to M4A)';
      }

      // Convert to MP3 if needed
      let finalBuffer = audioBuffer;
      let finalMimetype = 'audio/mpeg';
      let finalExtension = 'mp3';

      if (fileExtension !== 'mp3') {
        try {
          console.log(`Converting ${detectedFormat} → MP3 (size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
          finalBuffer = await toAudio(audioBuffer, fileExtension);
          if (!finalBuffer || finalBuffer.length === 0) {
            throw new Error('Conversion returned empty buffer');
          }
        } catch (convErr) {
          console.error('Conversion failed:', convErr);
          throw new Error(`Failed to convert to MP3: ${convErr.message}`);
        }
      }

      // ────────────────────────────────────────────────
      // Send the audio file
      // ────────────────────────────────────────────────
      const safeTitle = (video.title || 'song').replace(/[^\w\s-]/g, '').trim();

      await sock.sendMessage(chatId, {
        audio: finalBuffer,
        mimetype: finalMimetype,
        fileName: `${safeTitle}.${finalExtension}`,
        ptt: false,
        contextInfo: {
          externalAdReply: {
            title: video.title || 'YouTube Audio',
            body: `Downloaded via ${usedSource} • INFINITY MD`,
            thumbnail: video.thumbnail ? { url: video.thumbnail } : undefined,
            sourceUrl: video.url,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg });

      console.log(`Success - sent ${safeTitle} via ${usedSource}`);

      // ────────────────────────────────────────────────
      // Cleanup temp files (your original logic)
      // ────────────────────────────────────────────────
      try {
        const tempDir = path.join(__dirname, '../../temp');
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          const now = Date.now();
          files.forEach(file => {
            const filePath = path.join(tempDir, file);
            try {
              const stats = fs.statSync(filePath);
              if (now - stats.mtimeMs > 10000) {
                if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch {}
          });
        }
      } catch {}

    } catch (err) {
      console.error('Song command error:', err);

      let errorMessage = '❌ Failed to download song.';
      if (err.message.includes('All download sources failed')) {
        errorMessage = '❌ All sources failed (QasimDev + fallbacks). Try another song or check if the APIs are down.';
      } else if (err.message.includes('blocked') || err.message.includes('451')) {
        errorMessage = '❌ Content blocked or unavailable in your region (451).';
      } else if (err.message.includes('QasimDev')) {
        errorMessage = '❌ QasimDev API failed – possibly invalid key or service is down.';
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: errorMessage
      }, { quoted: msg });
    }
  }
};
