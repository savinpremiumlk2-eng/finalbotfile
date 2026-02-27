// movie.js - Pixeldrain → Telegram → WhatsApp (FIXED)
require('dotenv').config();
const { cmd } = require("../command");
const { sendButtons, sendInteractiveMessage } = require("gifted-btns");
const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");
const config = require("../config");
const FormData = require('form-data');
const axios = require('axios');

const pendingSearch = {};
const pendingQuality = {};
const channelJid = '120363418166326365@newsletter'; 
const channelName = '🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁';
const imageUrl = "https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/film.png?raw=true";

// Telegram Bot Setup
const tgBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ---------- Helpers ----------
function normalizeQuality(text) {
  if (!text) return null;
  text = text.toUpperCase();
  if (/1080|FHD/.test(text)) return "1080p";
  if (/720|HD/.test(text)) return "720p";
  if (/480|SD/.test(text)) return "480p";
  return text;
}

function getDirectPixeldrainUrl(url) {
  const match = url.match(/pixeldrain\.com\/u\/(\w+)/);
  if (!match) return null;
  
  const fileId = match[1];
  
  // Try multiple URL formats in order of likelihood
  const urlFormats = [
    `https://pixeldrain.com/api/file/${fileId}?download=1`,
    `https://pixeldrain.com/api/file/${fileId}?download`,
    `https://pixeldrain.com/l/${fileId}?download`,
    `https://dl.pixeldrain.com/api/file/${fileId}`,
    `https://pixeldrain.com/api/file/${fileId}`
  ];
  
  return urlFormats;
}

// Upload movie to Telegram
async function uploadToTelegram(fileId) {
  try {
    console.log("🔄 Downloading from Pixeldrain...");
    
    // Download file as stream
    const response = await axios({
      url: `https://pixeldrain.com/api/file/${fileId}?download=1`,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'TelegramBot',
        'Accept': 'video/mp4',
        'Referer': 'https://sinhalasub.lk/'
      },
      timeout: 300000
    });
    
    // Create form data
    const form = new FormData();
    form.append('chat_id', TELEGRAM_CHAT_ID);
    form.append('document', response.data, {
      filename: `${fileId}.mp4`,
      contentType: 'video/mp4'
    });
    form.append('caption', '🚀 Movie via DANUWA-MD');
    
    console.log("📤 Sending to Telegram API...");
    
    // Send directly to Telegram API
    const telegramResponse = await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Content-Length': response.headers['content-length']
        },
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    if (telegramResponse.data.ok) {
      console.log("✅ Telegram API success!");
      return telegramResponse.data.result.document.file_id;
    }
    
    return null;
  } catch (err) {
    console.error("❌ Direct API error:", err.response?.data || err.message);
    return null;
  }
}

// ---------- Movie Search ----------
async function searchMovies(query) {
  const url = `https://sinhalasub.lk/?s=${encodeURIComponent(query)}&post_type=movies`;
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  const results = await page.$$eval(".display-item .item-box", boxes =>
    boxes.slice(0, 10).map((box, index) => {
      const a = box.querySelector("a");
      const img = box.querySelector(".thumb");
      const lang = box.querySelector(".item-desc-giha .language")?.textContent || "";
      const quality = box.querySelector(".item-desc-giha .quality")?.textContent || "";
      const qty = box.querySelector(".item-desc-giha .qty")?.textContent || "";
      return {
        id: index + 1,
        title: a?.title?.trim() || "",
        movieUrl: a?.href || "",
        thumb: img?.src || "",
        language: lang.trim(),
        quality: quality.trim(),
        qty: qty.trim()
      };
    }).filter(m => m.title && m.movieUrl)
  );

  await browser.close();
  return results;
}

// ---------- Movie Metadata ----------
async function getMovieMetadata(url) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

  const metadata = await page.evaluate(() => {
    const getText = el => el?.textContent.trim() || "";
    const getList = selector => Array.from(document.querySelectorAll(selector)).map(el => el.textContent.trim());
    const title = getText(document.querySelector(".info-details .details-title h3"));
    let language = "", directors = [], stars = [];
    document.querySelectorAll(".info-col p").forEach(p => {
      const strong = p.querySelector("strong");
      if (!strong) return;
      const txt = strong.textContent.trim();
      if (txt.includes("Language:")) language = strong.nextSibling?.textContent?.trim() || "";
      if (txt.includes("Director:")) directors = Array.from(p.querySelectorAll("a")).map(a => a.textContent.trim());
      if (txt.includes("Stars:")) stars = Array.from(p.querySelectorAll("a")).map(a => a.textContent.trim());
    });
    return {
      title,
      language,
      duration: getText(document.querySelector(".data-views[itemprop='duration']")),
      imdb: getText(document.querySelector(".data-imdb"))?.replace("IMDb:", "").trim(),
      genres: getList(".details-genre a"),
      directors,
      stars,
      thumbnail: document.querySelector(".splash-bg img")?.src || ""
    };
  });

  await browser.close();
  return metadata;
}

// ---------- Pixeldrain Links ----------
async function getPixeldrainLinks(movieUrl) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(movieUrl, { waitUntil: "networkidle2", timeout: 30000 });

  const rows = await page.$$eval(".link-pixeldrain tbody tr", trs =>
    trs.map(tr => {
      const a = tr.querySelector(".link-opt a");
      const quality = tr.querySelector(".quality")?.textContent.trim() || "";
      const size = tr.querySelector("td:nth-child(3) span")?.textContent.trim() || "";
      return { pageLink: a?.href || "", quality, size };
    })
  );

  const links = [];
  for (const l of rows) {
    try {
      const sub = await browser.newPage();
      await sub.goto(l.pageLink, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(r => setTimeout(r, 8000)); // Reduced from 12s to 8s
      
      const finalUrl = await sub.$eval(".wait-done a[href^='https://pixeldrain.com/']", el => el.href).catch(() => null);
      
      if (finalUrl) {
        let sizeMB = 0;
        const sizeText = l.size.toUpperCase();
        if (sizeText.includes("GB")) sizeMB = parseFloat(sizeText) * 1024;
        else if (sizeText.includes("MB")) sizeMB = parseFloat(sizeText);
        
        if (sizeMB <= 2048) { // 2GB limit
          links.push({
            link: finalUrl,
            quality: normalizeQuality(l.quality),
            size: l.size,
            originalQuality: l.quality
          });
        }
      }
      await sub.close();
    } catch (err) {
      console.log("Error getting link:", err.message);
    }
  }
  
  await browser.close();
  return links;
}

/* ================= COMMAND: MOVIE SEARCH ================= */
cmd({
  pattern: "movie",
  alias: ["sinhalasub","films","cinema"],
  react: "🎬",
  desc: "Search SinhalaSub movies",
  category: "download",
  filename: __filename
}, async (danuwa, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply(`*🎬 Movie Search Plugin*\nUsage: movie_name\nExample: movie avengers`);

  const searchResults = await searchMovies(q);
  if (!searchResults.length) return reply("*❌ No movies found!*");

  pendingSearch[sender] = { results: searchResults, timestamp: Date.now() };

  if (config.BUTTON) {
    const rows = searchResults.map((movie, i) => ({
      id: `${i+1}`,
      title: movie.title,
      description: `Language: ${movie.language} | Quality: ${movie.quality} | Format: ${movie.qty}`
    }));

    const interactiveButtons = [
      { name: "single_select", buttonParamsJson: JSON.stringify({
        title: "Movie Search Results",
        sections: [{ title: "Select a movie", rows }]
      })}
    ];

    const caption = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗  
║     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    ║          
╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝  
📂 𝗠𝗢𝗩𝗜𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 📂  
┏━━━━━━━━━━━━━━━━━━━━━━┓  
┃ 🔰 𝗖𝗛𝗢𝗢𝗦𝗘 𝗬𝗢𝗨𝗥 MOVIE         
┃ 💬 *FOUND ${searchResults.length} MOVIES FOR "${q}"*❕  
┗━━━━━━━━━━━━━━━━━━━━━━┛  
┃━━━━━━━━━━━━━━━━━━━━━━✦
┃   ⚙️ M A D E  W I T H ❤️ B Y 
╰─🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥─╯`;

    await danuwa.sendMessage(from, { image: { url: imageUrl } }, { quoted: mek });
    await sendInteractiveMessage(danuwa, from, { text: caption, interactiveButtons, quoted: mek });

  } else {
    const numberEmojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
    let filmListMessage = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗  
║     🍁 ＤＡＮ𝑼𝑾𝑨－ 〽️Ｄ 🍁    ║          
╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝  
📂 𝗠𝗢𝗩𝗜𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 📂  
┏━━━━━━━━━━━━━━━━━━━━━━┓  
┃ 🔰 𝗖𝗛𝗢𝗢𝗦𝗘 𝗬𝗢𝗨𝗥 MOVIE         
┃ 💬 *FOUND ${searchResults.length} MOVIES FOR "${q}"*❕    
┗━━━━━━━━━━━━━━━━━━━━━━┛  
┃━━━━━━━━━━━━━━━━━━━━━━✦
┃   ⚙️ M A D E  W I T H ❤️ B Y 
╰─🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥─╯`;

    searchResults.forEach((movie, index) => {
      let adjustedIndex = index + 1;
      let emojiIndex = adjustedIndex.toString().split("").map(num => numberEmojis[num]).join("");
      filmListMessage += `${emojiIndex} *${movie.title}*\n\n`;
    });
    filmListMessage += `*📝 Reply with movie number (1-${searchResults.length})*`;

    await danuwa.sendMessage(from, {
      image: { url: imageUrl },
      caption: filmListMessage,
      contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: channelJid, newsletterName: channelName, serverMessageId: -1 } }
    }, { quoted: mek });
  }
});

/* ================= MOVIE SELECTION & QUALITY SELECTION ================= */
cmd({
  filter: (text, { sender }) => pendingSearch[sender] && !isNaN(text) && parseInt(text) > 0 && parseInt(text) <= pendingSearch[sender].results.length
}, async (danuwa, mek, m, { body, sender, reply, from }) => {
  await danuwa.sendMessage(from, { react: { text: "✅", key: m.key } });
  const index = parseInt(body) - 1;
  const selected = pendingSearch[sender].results[index];
  delete pendingSearch[sender];

  reply("*⏳ Getting movie details...*");
  const metadata = await getMovieMetadata(selected.movieUrl);

  let msg = `───────────────────────── 
*🎬 ${metadata.title}*
───────────────────────── 
*📝 Language:* ${metadata.language}
*⏱️ Duration:* ${metadata.duration}
*⭐ IMDb:* ${metadata.imdb}
*🎭 Genres:* ${metadata.genres.join(", ")}
*🎥 Directors:* ${metadata.directors.join(", ")}
───────────────────────── 
*🔍 Fetching download links...*`;

  if (metadata.thumbnail) {
    await danuwa.sendMessage(from, { image: { url: metadata.thumbnail }, caption: msg }, { quoted: mek });
  } else {
    await danuwa.sendMessage(from, { text: msg }, { quoted: mek });
  }

  // -------- Quality Selection --------
  const downloadLinks = await getPixeldrainLinks(selected.movieUrl);
  if (!downloadLinks.length) return reply("*❌ No download links found (<2GB)!*");

  pendingQuality[sender] = { movie: { metadata, downloadLinks }, timestamp: Date.now() };

  if (config.BUTTON) {
    const buttons = downloadLinks.map((d, i) => ({ 
      id: `${i+1}`, 
      text: `🎬 ${d.quality} (${d.size})` 
    }));
    await sendButtons(danuwa, from, { 
      text: `─────────────────────────\n*📝 CHOOSE QUALITY (${downloadLinks.length} options)*\n─────────────────────────`, 
      buttons 
    }, { quoted: mek });
  } else {
    let text = `─────────────────────────
📝 CHOOSE QUALITY (${downloadLinks.length} options)
─────────────────────────
`;
    downloadLinks.forEach((d, i) => {
      text += `${i+1}. 🎬 ${d.quality} (${d.size})\n`;
    });
    text += `\n*📝 Reply with number (1-${downloadLinks.length})*`;
    reply(text);
  }
});

/* ================= SEND MOVIE ================= */
/* ================= SEND MOVIE ================= */
cmd({
  filter: (text, { sender }) => pendingQuality[sender] && !isNaN(text) && parseInt(text) > 0 && parseInt(text) <= pendingQuality[sender].movie.downloadLinks.length
}, async (danuwa, mek, m, { body, sender, reply, from }) => {
  await danuwa.sendMessage(from, { react: { text: "✅", key: m.key } });
  const index = parseInt(body) - 1;
  const { movie } = pendingQuality[sender];
  delete pendingQuality[sender];

  const selectedLink = movie.downloadLinks[index];
  
  // Show processing message
  await reply(`*📤 Processing ${selectedLink.quality} quality...*\n_This may take a few minutes_`);

  try {
    // Extract fileId from Pixeldrain URL
    const match = selectedLink.link.match(/pixeldrain\.com\/u\/(\w+)/);
    if (!match) {
      throw new Error("Invalid Pixeldrain URL");
    }
    
    const fileId = match[1];
    
    // Try Telegram upload with CORS proxy
    const telegramFileId = await uploadToTelegram(fileId);
    
    if (!telegramFileId) {
      // Telegram failed, send direct link
      const directLinkMessage = `───────────────────────── 
*🎬 ${movie.metadata.title}*
───────────────────────── 
*📊 Quality:* ${selectedLink.quality}
*💾 Size:* ${selectedLink.size}
*🔗 Direct Link:* ${selectedLink.link}
─────────────────────────        
📥 *How to download:*
1. Open the link above
2. Click "Download" button
3. Save the file

⚠️ *Telegram upload failed. Please download directly.*
🚀 Pow. By *DANUKA DISANAYAKA* 🔥`;
      
      await danuwa.sendMessage(from, {
        text: directLinkMessage,
        contextInfo: { 
          forwardingScore: 999, 
          isForwarded: true, 
          forwardedNewsletterMessageInfo: { 
            newsletterJid: channelJid, 
            newsletterName: channelName, 
            serverMessageId: -1 
          } 
        }
      }, { quoted: mek });
      return;
    }
    
    // Telegram success! Send to WhatsApp
    await reply(`*✅ Uploaded to Telegram!*\n_Sending to WhatsApp now..._`);
    
    await danuwa.sendMessage(from, {
      document: { 
        url: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${telegramFileId}` 
      },
      mimetype: "video/mp4",
      fileName: `${movie.metadata.title.substring(0,50)} - ${selectedLink.quality}.mp4`.replace(/[^\w\s.-]/gi,''),
      caption: `───────────────────────── 
*🎬 ${movie.metadata.title}*
───────────────────────── 
*📊 Quality:* ${selectedLink.quality}
*💾 Size:* ${selectedLink.size}
─────────────────────────        
🚀 Pow. By *DANUKA DISANAYAKA* 🔥`,
      contextInfo: { 
        forwardingScore: 999, 
        isForwarded: true, 
        forwardedNewsletterMessageInfo: { 
          newsletterJid: channelJid, 
          newsletterName: channelName, 
          serverMessageId: -1 
        } 
      }
    }, { quoted: mek });

  } catch (error) {
    console.error("Send movie error:", error);
    await reply(`*❌ Error:* ${error.message || "Failed to send movie"}\n\nTry using the direct link or try another quality.`);
  }
});

/* ================= CLEANUP ================= */
setInterval(() => {
  const now = Date.now();
  const timeout = 10*60*1000;
  for (const s in pendingSearch) if (now - pendingSearch[s].timestamp > timeout) delete pendingSearch[s];
  for (const s in pendingQuality) if (now - pendingQuality[s].timestamp > timeout) delete pendingQuality[s];
}, 5*60*1000);

module.exports = { pendingSearch, pendingQuality };
