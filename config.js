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
  sessionID: process.env.SESSION_ID || 'KnightBot!H4sIAAAAAAAAA5VVXW+rOBD9L35tdAMOkBCp0kI+gJIQEkrTZHUfDBhwIMYxHwm5yn9fkbbbaqW9230z49GZ4zNnhl+AFqTENm7B+BdgnDSowt2xahkGY6DXcYw56IEIVQiMwWxVHCbRKokOUiY+bbPWXW4XObfCxNJWm2k8VOxdsF/CIE8ewa0HWB3kJPwN4KkIRkHGalsfaC9rX7X8yUzMfBxcX1wqtkQenRoThvHwUDyCW4eICCc0mbEUHzFHuY1bFxH+PfrIXElYmKRUambnBjXZaGRrk8tFnuXQzKBt76fJOtGzZrv+Hn11npzznGh64Cv7qVi3a2SglC2nhHNNNzdKvbSjs0+Pwu6NfkkSiiMrwrQiVftt3UOdB1MLXsk0Jk9XnV0rHUtPFkRiocxZvjcHg3WrMCgL0veIP80HAR8sBiScTg3JaG3DGenNck/1kVePBOrBPtx4VHST8itxl394Jfs/ugvuAb04wm4UHT0IhXW/5WdohtqpnfSFYBmf3D2/Djdrdet/j36zcdTpQnaL4YyJWOrPhJOY0v3L0c/12ksc/FppIn3Sr0bxSR9VNf8dSzG7JIOHfXicLIQyE1/traetj8PUVVDfUtVD47DDYb4ovFV2MOSNKe/sVi/hebEM68bTRKa41V7KTCE5m3RfB366Fw7rx/uLMtxaERiLtx7gOCFlxVFFCnqPDZQeQFHj4ZDj6i4v8LQjelb8XH692EdJ0cL+g4q3ZlJtWR/CbRHb1GPiytyU60fQA4wXIS5LHJmkrAreLnFZogSXYPznzx6g+FK9Na4rNxB7ICa8rHxas7xA0UdXPy5RGBY1rbyWhpPugDkYC59hXFWEJmWnY00RD1PS4EmKqhKMY5SX+O8XYo6j91gP5KisXF4wE5UpGAN3m8k66AFe1B2aRePiN42ZaL41XSdeJ+Q7jS47whUiedklrIzVpS5mM3tRP4Rnw5hYiTZJNPBJ+6P/b/qSfCYs1Dbom6fXmDwt1tCRV+xwMTY2L2Lh0oQcPk+dYQPv+v4TBIxBWqT17OTExiZZsD7dLc0QplfqiL4/21az12bvaJntVg9BavuiQeZNaKhRXS+DOJFEMrMcI83kpXOe0kzqb5fzV5XpnVl6IMINCfHXYvHcwRHe2rvtgFk8aM7R6przvYQFtq/P7DmOZY1Ohmnf67eHF2jBlSY/s5Wrqu6oobav4VKWl16zUBJTE+T1dtqukuTNmcf7SJCo22bScCgoIhREcQzVP8of566viLEfFFegB/J7FoQjKKjSSICCMBCULrO7+Biy/H25kbv9OuTuMyb4viso6ur9Z6U3CTpHCrfeF4j35fMvPtF3bONM+uGxf1HygUQ8wTng59NutMm8k2Kqy2Bgq9n5iodqBm63nz3AclTFBT92/wYa8YJE4M2r2ucQPJMjLit0ZGAsDoeiqsLREN7+AqkAsp86BwAA',
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
