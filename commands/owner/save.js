
const config = require('../../config');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'save',
  aliases: ['sv'],
  description: 'Save status (image/video) to your DM',
  usage: 'Reply to a status with .save',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, msg, args, { from, sender, reply, react }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || 
                     msg.message?.imageMessage?.contextInfo?.quotedMessage ||
                     msg.message?.videoMessage?.contextInfo?.quotedMessage;

      if (!quoted) return reply('❌ Please reply to a status message with .save');

      // Check if it's a status
      const remoteJid = msg.message?.extendedTextMessage?.contextInfo?.remoteJid;
      if (remoteJid !== 'status.broadcast') {
          // Allow saving regular media too if owner wants, but primary goal is status
      }

      const messageType = Object.keys(quoted)[0];
      if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(quoted[messageType], messageType === 'imageMessage' ? 'image' : 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        const caption = quoted[messageType].caption || '';
        await sock.sendMessage(sender, { 
          [messageType === 'imageMessage' ? 'image' : 'video']: buffer,
          caption: caption + '\n\n> *Saved by Infinity MD*'
        });
        await react('✅');
      } else if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
        const text = quoted.conversation || quoted.extendedTextMessage.text;
        await sock.sendMessage(sender, { text: `📝 *Status Text:*\n\n${text}\n\n> *Saved by Infinity MD*` });
        await react('✅');
      } else {
        reply('❌ Unsupported status type.');
      }
    } catch (error) {
      console.error('Save status error:', error);
      reply('❌ Error saving status.');
    }
  }
};
