const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט לשמירה על הבוט פעיל במארחים חיצוניים
http.createServer((req, res) => {
    res.write("SFS Safe Multi-Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configData);
    } catch (error) {
        console.error("שגיאה בטעינת config.json:", error.message);
        return {};
    }
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

// 🤬 רשימת קללות ומילים אסורות
const bannedWords = [
    'שרמוטה', 'זונה', 'מניאק', 'קוקסינל', 'הומו', 'נאצי', 'כוסאמאק', 'זין', 'שרמוט', 'בן זונה',
    'fuck', 'bitch', 'asshole', 'nigger', 'nigga', 'whore', 'slut'
];

const activeClears = new Map();

async function main() {
    const config = await loadConfig();
    // קריאת הטוקן בבטחה ממשתני הסביבה (TOKEN / DISCORD_TOKEN) או מקובץ ה-config
    const botToken = process.env.TOKEN || process.env.DISCORD_TOKEN || config.token;

    if (!botToken) {
        console.error("❌ לא נמצא טוקן! יש להגדיר TOKEN במשתני הסביבה (Environment Variables) במארח.");
        return;
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    client.once('ready', async () => { 
        console.log(`Bot connected as ${client.user.tag}! Auto-Mod Active.`); 
        client.guilds.cache.forEach(guild => {
            updateMemberCount(guild, config.memberCountChannelId);
        });
    });

    // 🎈 מערכת ברוכים הבאים
    client.on('guildMemberAdd', async (member) => {
        const bannerUrl = config.bannerUrl;
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

    // 🛡️ מערכת ניקוי צ'אט + Auto-Mod (הגנה אוטומטית)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const hasAllowedRole = message.member.roles.cache.has(config.allowedClearRoleId);

        // ----------------------------------------------------
        // חלק א': Auto-Mod - פועל רק על משתמשים שאין להם את רול הניהול
        // ----------------------------------------------------
        if (!hasAllowedRole) {
            const messageContentLower = message.content.toLowerCase();

            // 1. בדיקת קללות ומילים אסורות
            const containsBannedWord = bannedWords.some(word => messageContentLower.includes(word));
            
            if (containsBannedWord) {
                await message.delete().catch(() => null);
                return message.channel.send(`⚠️ ${message.author}, שמור על השפה שלך! אסור לקלל בשרת הזה. ❌`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }

            // 2. בדיקת קישורי הזמנה לשרתים אחרים (Anti-Invite)
            if (messageContentLower.includes('discord.gg/') || messageContentLower.includes('://discord.com')) {
                await message.delete().catch(() => null);
                return message.channel.send(`🚫 ${message.author}, חל איסור מוחלט לפרסם שרתי דיסקורד אחרים! ❌`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }
        }

        // ----------------------------------------------------
        // חלק ב': מערכת ניקוי צ'אט האינטראקטיבית (!clear)
        // ----------------------------------------------------
        if (message.content.trim() === 'ניקוי') {
            if (!hasAllowedRole) {
                return message.reply('אין לך את הרול המתאים כדי לנהל שיחת ניקוי עם הבוט! ❌').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 3000);
                    setTimeout(() => message.delete().catch(() => null), 3000);
                });
            }
            activeClears.set(`${message.author.id}-${message.channel.id}`, true);
            return message.reply('כמה? 🤔');
        }

        const sessionKey = `${message.author.id}-${message.channel.id}`;
        if (activeClears.has(sessionKey)) {
            activeClears.delete(sessionKey);
            const amount = parseInt(message.content.trim());

            if (isNaN(amount) || amount < 1 || amount > 100) {
                return message.reply('התהליך בוטל. נא לבחור מספר תקין בין 1 ל-100 בשלב הבא! 🔢').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }

            // הגבלה של מקסימום 100 הודעות (מגבלת דיסקורד)
            const deleteCount = Math.min(amount + 2, 100);

            await message.channel.bulkDelete(deleteCount, true)
                .then(deletedMessages => {
                    const actualDeleted = Math.max(deletedMessages.size - 2, 0);
                    message.channel.send(`🧹 ניקיתי בהצלחה **${actualDeleted}** הודעות לבקשתך!`).then(msg => {
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
