const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("SFS Multi-Bot with Advanced Clear is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

async function updateMemberCount(guild, channelId) {
    if (!channelId) return;
    try {
        const memberCountChannel = await guild.channels.fetch(channelId).catch(() => null);
        if (memberCountChannel) {
            const totalMembers = guild.memberCount;
            await memberCountChannel.setName(`👥 חברים בשרת: ${totalMembers}`);
        }
    } catch (error) {
        console.error("שגיאה בעדכון המונה:", error.message);
    }
}

// מפת זיכרון זמנית כדי לזכור מי נמצא באמצע תהליך ניקוי
const activeClears = new Map();

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

    // 🎈 מערכת ברוכים הבאים
    client.on('guildMemberAdd', async (member) => {
        const bannerUrl = 'https://discordapp.net';
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

        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
        if (welcomeChannel) {
            const imageEmbed = new EmbedBuilder().setColor('#5865F2').setImage(bannerUrl);
            await welcomeChannel.send({ embeds: [imageEmbed] }).catch(() => null);
            await welcomeChannel.send(`${member} ברוך הבא יעמה! מקווים שתהנה💜`).catch(() => null);
        }
        updateMemberCount(member.guild, config.memberCountChannelId);
    });

    client.on('guildMemberRemove', async (member) => {
        updateMemberCount(member.guild, config.memberCountChannelId);
    });

    // 🧹 מערכת צ'אט אינטרנטית ונעולה לרול ספציפי
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // 🛑 שלב א': בדיקת הרול המורשה
        // הבוט בודק אם למשתמש שכתב יש את הרול הייחודי שמוגדר ב-config.json
        const hasAllowedRole = message.member.roles.cache.has(config.allowedClearRoleId);

        // אם המשתמש מנסה להתחיל תהליך ניקוי
        if (message.content.trim() === 'ניקוי') {
            if (!hasAllowedRole) {
                return message.reply('אין לך את הרול המתאים כדי לנהל שיחת ניקוי עם הבוט! ❌').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 3000);
                    setTimeout(() => message.delete().catch(() => null), 3000);
                });
            }

            // מסמן בזיכרון שהמשתמש הזה התחיל תהליך ניקוי בחדר הזה
            activeClears.set(`${message.author.id}-${message.channel.id}`, true);
            return message.reply('כמה? 🤔');
        }

        // 🛑 שלב ב': המשתמש המורשה עונה "כמה" הודעות למחוק
        const sessionKey = `${message.author.id}-${message.channel.id}`;
        if (activeClears.has(sessionKey)) {
            // מוחק את הסטטוס הזמני מהזיכרון כדי שלא ייתקע בלולאה
            activeClears.delete(sessionKey);

            const amount = parseInt(message.content.trim());

            // בדיקה אם המשתמש החזיר מספר תקין
            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('התהליך בוטל. נא לבחור מספר תקין בין 1 ל-100 בשלב הבא! 🔢').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }

            // ביצוע מחיקה המונית (מוחק את הודעת המספר, את הודעת ה"כמה?" של הבוט, ואת כמות ההודעות שביקשת)
            await message.channel.bulkDelete(amount + 2, true)
                .then(deletedMessages => {
                    message.channel.send(`🧹 ניקיתי בהצלחה **${deletedMessages.size - 2}** הודעות לבקשתך!`).then(msg => {
                        setTimeout(() => msg.delete().catch(() => null), 3000);
                    });
                })
                .catch(err => {
                    console.error(err);
                    message.channel.send('התרחשה שגיאה. שים לב שאי אפשר למחוק הודעות ישנות משבועיים! ❌');
                });
        }
    });

    client.login(botToken);
}

main().catch(console.error);
