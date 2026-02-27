const axios = require('axios');
const { cmd } = require('../../command');

const pendingFilm3 = {};

cmd({
    pattern: "film3",
    alias: ["movie3", "subslk3"],
    react: "🎬",
    desc: "Search and download movies from Subslk",
    category: "download",
    filename: __filename
}, async (sock, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("Please provide a movie name.");

    try {
        const apikey = "dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi";
        const response = await axios.get(`https://api.srihub.store/movie/subslk?q=${encodeURIComponent(q)}&apikey=${apikey}`);

        if (!response.data || !response.data.result || response.data.result.length === 0) {
            return reply("❌ No movie results found.");
        }

        const results = response.data.result.slice(0, 10);
        pendingFilm3[sender] = { results, timestamp: Date.now() };

        let message = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗\n`;
        message += `║     🍁 Infinity－ 〽️Ｄ 🍁    ║\n`;
        message += `╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝\n`;
        message += `🎬 *MOVIE SEARCH RESULTS*\n\n`;

        results.forEach((movie, index) => {
            message += `*${index + 1}. ${movie.title}*\n`;
        });

        message += `\n*📝 Reply with movie number (1-${results.length}) to get download links.*`;

        if (results[0].thumbnail) {
            await sock.sendMessage(from, { image: { url: results[0].thumbnail }, caption: message }, { quoted: mek });
        } else {
            await reply(message);
        }

    } catch (error) {
        console.error("Film3 search error:", error);
        reply("❌ Error fetching movie results.");
    }
});

// Listener for selection
cmd({
    filter: (text, { sender }) => pendingFilm3[sender] && !isNaN(text) && parseInt(text) > 0 && parseInt(text) <= pendingFilm3[sender].results.length
}, async (sock, mek, m, { body, sender, reply, from }) => {
    const index = parseInt(body) - 1;
    const selected = pendingFilm3[sender].results[index];
    delete pendingFilm3[sender];

    reply(`*⏳ Fetching download links for:* ${selected.title}...`);

    try {
        const apikey = "dew_FEIXBd8x3XE6eshtBtM1NwEV5IxSLI6PeRE2zLmi";
        const response = await axios.get(`https://api.srihub.store/movie/subslkdl?url=${encodeURIComponent(selected.url)}&apikey=${apikey}`);

        if (!response.data || !response.data.result || !response.data.result.downloadLinks || response.data.result.downloadLinks.length === 0) {
            return reply("❌ No download links found for this movie.");
        }

        const links = response.data.result.downloadLinks;
        let dlMsg = `🎬 *${selected.title}*\n\n`;
        dlMsg += `📦 *Download Links:*\n\n`;

        links.forEach((link, i) => {
            dlMsg += `*${i + 1}. ${link.label}*\n`;
            dlMsg += `🌐 Host: ${link.host}\n`;
            dlMsg += `🔗 URL: ${link.url}\n\n`;
        });

        dlMsg += `🚀 Powered by *DANUWA-MD*`;

        await sock.sendMessage(from, { text: dlMsg }, { quoted: mek });

    } catch (error) {
        console.error("Film3 download error:", error);
        reply("❌ Error fetching download links.");
    }
});

// Cleanup
setInterval(() => {
    const now = Date.now();
    for (const s in pendingFilm3) {
        if (now - pendingFilm3[s].timestamp > 10 * 60 * 1000) delete pendingFilm3[s];
    }
}, 5 * 60 * 1000);
