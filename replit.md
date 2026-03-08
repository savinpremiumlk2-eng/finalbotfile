# Infinity MD - WhatsApp Multi-Device Bot

## Overview
WhatsApp MD bot built with Baileys (multi-device), Express web dashboard, and SQLite database. Supports multiple bot sessions managed through a web dashboard.

## Architecture
- **Entry point:** `index.js` - Express server + Baileys WhatsApp connection manager
- **Config:** `config.js` - Global bot settings (prefix, owner, behavior toggles)
- **Settings:** `settings.js` - Additional settings
- **Database:** `database.js` - SQLite wrapper (`database/bot.db`)
- **Handler:** `handler.js` - Message routing, command parsing, anti-spam/antilink/welcome systems
- **Command loader:** `utils/commandLoader.js` - Auto-loads all `.js` files from `commands/` subdirectories

## Commands Structure
Commands are organized in `commands/<category>/<name>.js`. Each exports:
```js
module.exports = {
  name: 'commandname',
  aliases: ['alias1'],
  category: 'categoryname',
  description: 'What it does',
  usage: '.commandname <args>',
  async execute(sock, msg, args, extra) { ... }
}
```

### Categories & Plugins
- **admin/** - Group admin tools (antilink, kick, mute, warn, welcome, goodbye, etc.)
- **ai/** - AI commands (ai, aimaths, magicstudio)
- **anime/** - Anime image commands (waifu, neko, etc.)
- **fun/** - Entertainment (joke, meme, dare, truth, ship, gayrate, 8ball, coinflip, roll, rps, trivia, quote, emojimix)
- **general/** - Core commands (menu, ping, sticker, uptime, qr, whois, report, etc.)
- **media/** - Downloaders (song, video, tiktok, instagram, facebook, lyrics, sinhanada)
- **movie/** - Movie search/download (film2, movie)
- **nsfw/** - NSFW content (restricted)
- **owner/** - Bot owner commands (mode, block, restart, autopp, etc.)
- **utility/** - Tools (weather, translate, calc, wiki, shorten, remind, base64, wordcount)

## Key Dependencies
- `@whiskeysockets/baileys` - WhatsApp Web API
- `express` + `express-session` - Web dashboard
- `sqlite3` - Database
- `sharp`, `canvas`, `jimp` - Image processing
- `ffmpeg-static`, `fluent-ffmpeg` - Media conversion
- `axios`, `cheerio` - HTTP/scraping
- `node-webpmux` - Sticker EXIF metadata
- `pino` - Logging

## Two-Tier Settings System
Settings merge in order of specificity (most specific wins):
1. **Global Settings** (owner-only) — affects all bots across all users. Includes maintenance mode, force bot, etc.
2. **User Settings** (per-user) — affects all bots owned by that user. Stored in `user_settings` table.
3. **Session Settings** (per-bot) — affects a single bot instance. Set in bot edit panel.

Merge chain in handler.js: `globalSettings → userSettings → sessionSettings`

## Web Dashboard
- Port 3000 (default), PORT=5000 set in dev workflow for Replit webview
- Deployment: VM target (always-on), uses port 3000
- Health endpoint: `/health` returns 200 OK
- Routes: `/login`, `/signup`, `/dashboard`
- API: `/api/sessions`, `/api/session/add|update|delete|restart`, `/api/admin/*`
- Settings API: `/api/user-settings`, `/api/user-settings/update`, `/api/global-settings`, `/api/global-settings/update`
- Pairing API: `/api/pair` (POST, requires phone number), `/api/qr` (GET, generates QR code)

## Bot Connection Methods (Deploy Bot page)
Three ways to connect a new bot, selectable via tabs:
1. **Session ID** — Paste a `KnightBot!...` encoded session string (original method)
2. **Pair Code** — Enter WhatsApp number, get an 8-digit code to enter in WhatsApp > Linked Devices > Link with phone number
3. **QR Code** — Generate a QR code to scan from WhatsApp > Linked Devices > Link a Device

All three methods auto-deploy the bot session after successful connection. Pair/QR sessions are stored with IDs prefixed `paired_` or `qr_` respectively. Temporary pairing sockets are tracked in `pairSessions` Map and cleaned up after connection or timeout.

## Environment
- Node.js 20 on NixOS
- System packages: ffmpeg, pkg-config, cairo, pango, libjpeg, giflib, librsvg
