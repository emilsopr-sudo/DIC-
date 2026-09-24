const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("SFS Multi-Bot with Custom Banner is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

// פונקציה שמעדכנת את מונה המשתמשים בערוץ הקולי
async function updateMemberCount(guild, channelId) {
    if (!channelId) return;
    try {
        const memberCountChannel = await guild.channels.fetch(channelId).catch(() => null);
        if (memberCountChannel) {
            const totalMembers = guild.memberCount;
            await memberCountChannel.setName(`👥 חברים בשרת: ${totalMembers}`);
            console.log(`מונה עודכן ל: ${totalMembers}`);
        }
    } catch (error) {
        console.error("שגיאה בעדכון המונה:", error.message);
    }
}

async function main() {
    const config = await loadConfig();
    const botToken = config.token === "PROCESS_ENV_TOKEN" ? process.env.DISCORD_TOKEN : config.token;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    client.once('ready', async () => { 
        console.log(`Bot connected as ${client.user.tag}!`); 
        client.guilds.cache.forEach(guild => {
            updateMemberCount(guild, config.memberCountChannelId);
        });
    });

    // 🎈 מערכת ברוכים הבאים (Welcome System)
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} נכנס לשרת.`);
        
        // 🖼️ הקישור הישיר לבאנר המטורף שלך שהוכנס אוטומטית לקוד!
        const bannerUrl = 'https://media.discordapp.net/attachments/1552769614818058335/1552789243393343579/image.png?ex=6ab6e32d&is=6ab591ad&hm=902ff97601c1b774187fa1e6e9934f6dca6da1322dd4cf7177e975e10876d99b&=&format=webp&quality=lossless';

        // 1. הודעה מעוצבת בפרטי (DM)
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🇮🇱 ברוכים הבאים ל-SFS 🇮🇱')
            .setDescription(
                `👋 אהלן ${member} וברוך הבא לשרת הרשמי של **SFS**!\n` +
                `תפסו כיסא בפרלמנט, תכינו קפה ותתחילו להכיר אנשים.\n` +
                `כאן לא עושים פוזות, כולם מדברים עם כולם.\n\n` +
                `**לפני שאתה קופץ למים, תעשה סיבוב קצר:**\n` +
                `📜 תראה מה מותר ומה אסור ב- <#1552769582278648009>\n` +
                `🎭 תבחר מה מעניין אותך ב- <#1552769584795226273>\n` +
                `💬 ובוא להגיד שלום ב- <#1552769592378658939>\n\n` +
                `יאללה, בלי להתבייש. תהנו! 💜`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setImage(bannerUrl)
            .setTimestamp();

        try { await member.send({ embeds: [welcomeEmbed] }); } catch (e) {}

        // 2. הודעה ותמונה בערוץ בשרת
        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
        if (welcomeChannel) {
            const imageEmbed = new EmbedBuilder().setColor('#5865F2').setImage(bannerUrl);
            await welcomeChannel.send({ embeds: [imageEmbed] }).catch(() => null);
            await welcomeChannel.send(`${member} ברוך הבא יעמה! מקווים שתהנה💜`).catch(() => null);
        }

        // 3. עדכון מונה משתמשים
        updateMemberCount(member.guild, config.memberCountChannelId);
    });

    // 🏃‍♂️ מערכת עזיבת משתמש (עדכון מונה)
    client.on('guildMemberRemove', async (member) => {
        updateMemberCount(member.guild, config.memberCountChannelId);
    });

    // 🧹 מערכת ניקוי צ'אט מהירה (!clear)
    client.on('messageCreate', async (message) => {
        const prefix = '!';
        if (!message.content.startsWith(prefix) || message.author.bot) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'clear') {
            if (!message.member.permissions.has('ManageMessages')) {
                return message.reply('אין לך הרשאה להשתמש בפקודה הזו! ❌').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 3000);
                });
            }

            const amount = parseInt(args);

            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('נא לבחור מספר הודעות למחיקה בין 1 ל-100! 🔢').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }

            await message.channel.bulkDelete(amount + 1, true)
                .then(deletedMessages => {
                    message.channel.send(`🧹 ניקיתי בהצלחה **${deletedMessages.size - 1}** הודעות מהצ'אט!`).then(msg => {
                        setTimeout(() => msg.delete().catch(() => null), 3000);
                    });
                })
                .catch(err => {
                    console.error(err);
                    message.channel.send('התרחשה שגיאה בניסיון למחוק הודעות. (שים לב שאי אפשר למחוק הודעות ישנות משבועיים!) ❌');
                });
        }
    });

    client.login(botToken);
}

main().catch(console.error);


