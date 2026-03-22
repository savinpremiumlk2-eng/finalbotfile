const fs = require('fs');
const path = require('path');
const config = require('../../config');

module.exports = {
    name: 'autovoice',
    aliases: ['voice', 'autovn'],
    category: 'owner',
    description: 'Toggle auto-voice (recording) indicator',
    usage: '.autovoice <on|off>',
    ownerOnly: true,

    async execute(sock, message, args, context = {}) {
        const chatId = context.from || message.key.remoteJid;
        const action = args[0]?.toLowerCase();
        
        try {
            const configPath = path.join(__dirname, '../../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');

            if (!action) {
                const isEnabled = config.autoVoice || false;
                return sock.sendMessage(chatId, {
                    text: `🎤 *AUTOVOICE STATUS*\n\nCurrent: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n\nUse \`.autovoice on\` or \`.autovoice off\``
                }, { quoted: message });
            }

            if (action === 'on' || action === 'enable') {
                configContent = configContent.replace(/autoVoice:\s*(true|false)/, 'autoVoice: true');
                if (!configContent.includes('autoVoice:')) {
                    configContent = configContent.replace('autoTyping:', 'autoVoice: true,\n  autoTyping:');
                }
                fs.writeFileSync(configPath, configContent);
                return sock.sendMessage(chatId, { text: '✅ *Auto-voice enabled!*' }, { quoted: message });
            } else if (action === 'off' || action === 'disable') {
                configContent = configContent.replace(/autoVoice:\s*(true|false)/, 'autoVoice: false');
                fs.writeFileSync(configPath, configContent);
                return sock.sendMessage(chatId, { text: '❌ *Auto-voice disabled!*' }, { quoted: message });
            } else {
                return sock.sendMessage(chatId, { text: '❌ Use: `.autovoice on/off`' }, { quoted: message });
            }
        } catch (error) {
            console.error('Error in autovoice command:', error);
            return sock.sendMessage(chatId, { text: '❌ Error processing command.' }, { quoted: message });
        }
    }
};
