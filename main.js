
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
 
// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("SFS Safe Multi-Bot is running!");
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
 
// 🤬 רשימת קללות ומילים אסורות (תוכל להוסיף או לשנות כאן מילים בתוך הגרשיים)
const bannedWords = [
    'שרמוטה', 'זונה', 'מניאק', 'קוקסינל', 'נאצי', 'כוסאמאק', 'זין', 'שרמוט', 'בן זונה',
    'fuck', 'bitch', 'asshole', 'nigger', 'nigga', 'whore', 'slut'
];
 
// בונה regex אחת עם "גבולות מילה" כדי למנוע תפיסת מילים תמימות שמכילות תת-מחרוזת אסורה
// (למשל "classic" לא יתפוס "ass"). עובד גם על עברית וגם על אנגלית.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bannedWordsRegex = new RegExp(
    '(^|[^א-תa-zA-Z0-9])(' + bannedWords.map(escapeRegex).join('|') + ')($|[^א-תa-zA-Z0-9])',
    'i'
);
 
// session-ים פעילים של "ניקוי" + הטיימר שמנקה אותם אם אין תגובה
const activeClears = new Map();
const CLEAR_SESSION_TIMEOUT_MS = 60 * 1000; // דקה, ואז ה-session מתבטל לבד
 
function startClearSession(sessionKey) {
    // אם כבר קיים session ישן לאותו מפתח, מבטלים את הטיימר הקודם
    const existing = activeClears.get(sessionKey);
    if (existing) clearTimeout(existing);
 
    const timeoutId = setTimeout(() => {
        activeClears.delete(sessionKey);
    }, CLEAR_SESSION_TIMEOUT_MS);
 
    activeClears.set(sessionKey, timeoutId);
}
 
function endClearSession(sessionKey) {
    const existing = activeClears.get(sessionKey);
    if (existing) clearTimeout(existing);
    activeClears.delete(sessionKey);
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
 
        // תיקון: message.member יכול להיות null (למשל הודעות partial) — לא רוצים קריסה
        const hasAllowedRole = Boolean(message.member?.roles.cache.has(config.allowedClearRoleId));
 
        // ----------------------------------------------------
        // חלק א': Auto-Mod - פועל רק על משתמשים שאין להם את רול הניהול
        // ----------------------------------------------------
        if (!hasAllowedRole) {
            const messageContentLower = message.content.toLowerCase();
 
            // 1. בדיקת קללות ומילים אסורות (עם גבולות מילה, לא substring גולמי)
            const containsBannedWord = bannedWordsRegex.test(messageContentLower);
 
            if (containsBannedWord) {
                await message.delete().catch(() => null); // מחיקת ההודעה המקוללת בשנייה
                return message.channel.send(`⚠️ ${message.author}, שמור על השפה שלך! אסור לקלל בשרת הזה. ❌`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000); // מחיקת האזהרה אחרי 4 שניות
                });
            }
 
            // 2. בדיקת קישורי הזמנה לשרתים אחרים (Anti-Invite)
            if (messageContentLower.includes('discord.gg/') || messageContentLower.includes('://discord.com')) {
                await message.delete().catch(() => null); // מחיקת הקישור המפרסם בשנייה
                return message.channel.send(`🚫 ${message.author}, חל איסור מוחלט לפרסם שרתי דיסקורד אחרים! ❌`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }
        }
 
        // ----------------------------------------------------
        // חלק ב': מערכת ניקוי צ'אט האינטראקטיבית (ניקוי)
        // ----------------------------------------------------
        const sessionKey = `${message.author.id}-${message.channel.id}`;
 
        if (message.content.trim() === 'ניקוי') {
            if (!hasAllowedRole) {
                return message.reply('אין לך את הרול המתאים כדי לנהל שיחת ניקוי עם הבוט! ❌').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 3000);
                    setTimeout(() => message.delete().catch(() => null), 3000);
                });
            }
            startClearSession(sessionKey);
            return message.reply('כמה? 🤔 (יש לך דקה לענות, אחרת הבקשה תתבטל)');
        }
 
        if (activeClears.has(sessionKey)) {
            const amount = parseInt(message.content.trim());
 
            // אם ההודעה לא נראית כמו ניסיון להזין מספר בכלל (למשל שיחה רגילה),
            // לא מבטלים את ה-session - פשוט מתעלמים וממשיכים לחכות.
            if (isNaN(amount)) {
                return;
            }
 
            endClearSession(sessionKey);
 
            if (amount < 1 || amount > 100) {
                return message.reply('התהליך בוטל. נא לבחור מספר תקין בין 1 ל-100 בשלב הבא! 🔢').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }
 
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

