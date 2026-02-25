/**
 * Global Configuration for WhatsApp MD Bot
 */

module.exports = {
  // Bot Owner Configuration
  ownerNumber: ['94770612011'], // Your Sri Lankan number (no +, correct format)
  ownerName: ['Infinity Team'],

  // Bot Configuration
  botName: 'Infinity MD',
  prefix: '.',
  sessionName: 'session',
  sessionID: process.env.SESSION_ID || '',
  newsletterJid: '120363161513685998@newsletter',

  // Keep update link empty as requested
  updateZipUrl: '',

  // Sticker Configuration
  packname: 'Infinity MD',

  // Bot Behavior
  selfMode: false,
  autoRead: false,
  autoTyping: false,
  autoBio: false,
  autoSticker: false,
  autoReact: false,
  autoReactMode: 'bot',
  autoDownload: false,

  // Group Settings Defaults
  defaultGroupSettings: {
    antilink: false,
    antilinkAction: 'delete',
    antitag: false,
    antitagAction: 'delete',
    antiall: false,
    antiviewonce: false,
    antibot: false,
    anticall: false,
    antigroupmention: false,
    antigroupmentionAction: 'delete',
    welcome: false,
    welcomeMessage:
      '╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n' +
      '┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @user 👋\n' +
      '┃Member count: #memberCount\n' +
      '┃𝚃𝙸𝙼𝙴: time⏰\n' +
      '╰━━━━━━━━━━━━━━━╯\n\n' +
      '*@user* Welcome to *@group*! 🎉\n' +
      '*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\n' +
      'groupDesc\n\n' +
      '> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ Infinity MD*',

    goodbye: false,
    goodbyeMessage: 'Goodbye @user 👋',
    antiSpam: false,
    antidelete: false,
    nsfw: false,
    detect: false,
    chatbot: false,
    autosticker: false
  },

  // API Keys
  apiKeys: {
    openai: '',
    deepai: '',
    remove_bg: ''
  },

  // Message Configuration
  messages: {
    wait: '⏳ Infinity MD is processing...',
    success: '✅ Done by Infinity MD!',
    error: '❌ Something went wrong!',
    ownerOnly: '👑 Only Infinity Team can use this!',
    adminOnly: '🛡️ Admin only command!',
    groupOnly: '👥 Use this in groups only!',
    privateOnly: '💬 Use this in private chat only!',
    botAdminNeeded: '🤖 Bot needs admin rights!',
    invalidCommand: '❓ Unknown command. Type .menu'
  },

  // Country / Timezone
  country: 'Sri Lanka',
  timezone: 'Asia/Colombo',

  // Limits
  maxWarnings: 3,

  // Social Links (kept empty as requested)
  social: {
    github: '',
    instagram: '',
    youtube: ''
  }
};