const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("SFS Custom Premium Design Bot with Rules is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

// 👥 עדכון מונה המשתמשים בעיצוב החדש והמדויק שלך!
async function updateMemberCount(guild, channelId, welcomeChannelId) {
    if (!channelId || channelId === welcomeChannelId) {
        console.log("התראה: ערוץ המונה לא מוגדר או זהה לערוץ הברכות. העדכון בוטל.");
        return;
    }
    try {
        const memberCountChannel = await guild.channels.fetch(channelId).catch(() => null);
        if (memberCountChannel) {
            const totalMembers = guild.memberCount;
            await memberCountChannel.setName(`👥┋חברים・בשרת・${totalMembers}`);
            console.log(`מונה עודכן בהצלחה ל- ${totalMembers}`);
        }
    } catch (error) {
        console.error("שגיאה בעדכון המונה:", error.message);
    }
}

const activeClears = new Map();

// 🤬 רשימת קללות ומילים אסורות (Auto-Mod)
const bannedWords = [
    'שרמוטה', 'זונה', 'מניאק', 'קוקסינל', 'הומו', 'נאצי', 'כוסאמאק', 'זין', 'שרמוט', 'בן זונה',
    'fuck', 'bitch', 'asshole', 'nigger', 'nigga', 'whore', 'slut'
];

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
        console.log(`SFS Premium Bot connected as ${client.user.tag}! Rules system active.`); 
        client.guilds.cache.forEach(guild => {
            updateMemberCount(guild, config.memberCountChannelId, config.welcomeChannelId);
        });
    });

    // 🎈 מערכת ברוכים הבאים
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} נכנס לשרת SFS.`);
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

        updateMemberCount(member.guild, config.memberCountChannelId, config.welcomeChannelId);
    });

    client.on('guildMemberRemove', async (member) => {
        updateMemberCount(member.guild, config.memberCountChannelId, config.welcomeChannelId);
    });

    // 🧹 מערכת ניקוי צ'אט + Auto-Mod + פקודת ספר חוקים
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const hasAllowedRole = message.member.roles.cache.has(config.allowedClearRoleId);

        // Auto-Mod (הגנה אוטומטית מקללות)
        if (!hasAllowedRole) {
            const messageContentLower = message.content.toLowerCase();
            const containsBannedWord = bannedWords.some(word => messageContentLower.includes(word));
            if (containsBannedWord) {
                await message.delete().catch(() => null);
                return message.channel.send(`⚠️ ${message.author}, שמור על השפה שלך! אסור לקלל בשרת. ❌`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }
            if (messageContentLower.includes('discord.gg/') || messageContentLower.includes('://discord.com')) {
                await message.delete().catch(() => null);
                return message.channel.send(`🚫 ${message.author}, חל איסור מוחלט לפרסם שרתי דיסקורד אחרים! ❌`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }
        }

        const prefix = '!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 📜 פקודה חדשה: יצירת חלון החוקים המקצועי לשרת
        if (command === 'חוקים') {
            // רק מי שיש לו את רול הניהול יכול לשלוח את חלון החוקים
            if (!hasAllowedRole) return;

            // מוחק את הודעת הפקודה הישנה שכתבת (!חוקים) כדי להשאיר את הערוץ נקי
            await message.delete().catch(() => null);

            const rulesEmbed = new EmbedBuilder()
                .setColor('#5865F2') // צבע סגול פרימיום
                .setTitle('📜┃ספר החוקים הרשמי — SFS SERVER ♛')
                .setDescription(
                    `ברוכים הבאים לפרלמנט של **SFS**. כדי לשמור על שרת מקצועי, בוגר ומהנה לכולם, חובה לקרוא ולכבד את החוקים הבאים:\n\n` +
                    `⚖️ **[1] כבוד הדדי**\n` +
                    `יש להתנהג בכבוד לכל חברי השרת ולצוות הניהול. דיבור מגעיל, התגרות או זלזול באחרים יובילו להרחקה מידית מהשרת.\n\n` +
                    `🚫 **[2] קללות וביטויים פוגעניים**\n` +
                    `השרת מוגן במערכת אבטחה אוטומטית. חל איסור מוחלט על שימוש בקללות, גזענות, או דיבור פוגעני. הודעות כאלו יימחקו בשנייה והמשתמש ייענש.\n\n` +
                    `📢 **[3] פרסום וספאם**\n` +
                    `אין לפרסם שרתי דיסקורד אחרים, קישורים חיצוניים או לבצע ספאם המוני (הצפה של הודעות או תיוגים מיותרים) בצ'אטים.\n\n` +
                    `🎮 **[4] סדר בחדרים**\n` +
                    `נא להשתמש בכל חדר למטרה שלו (למשל: פקודות של בוטים בחדר \`#פקודות-בוטים\`, דיבורי גיימינג בחדרים המתאימים וכו').\n\n` +
                    `🎙️ **[5] שיחות קוליות**\n` +
                    `אין להספים מוזיקה, לצעוק או להפריע בחדרים הקוליים. משתמשים שלא פעילים יועברו אוטומטית לחדר \`💤┃AFK\`.\n\n` +
                    `💜 *הנהלת השרת שומרת לעצמה את הזכות לפעול נגד כל משתמש שיפר את הסדר הציבורי בפרלמנט. תהנו!*`
                )
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setFooter({ text: 'SFS SERVER ♛ • שומרים על אווירה טובה' })
                .setTimestamp();

            return message.channel.send({ embeds: [rulesEmbed] });
        }

        // פקודת ניקוי
        if (command === 'ניקוי') {
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
                return message.reply('התהליך בוטל. נא לבחור מספר תקין בין 1 ל-100! 🔢').then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 4000);
                });
            }
            await message.channel.bulkDelete(amount + 2, true)
                .then(deletedMessages => {
                    message.channel.send(`🧹 ניקיתי בהצלחה **${deletedMessages.size - 2}** הודעות לבקשתך!`).then(msg => {
                        setTimeout(() => msg.delete().catch(() => null), 3000);
                    });
                }).catch(() => null);
            return;
        }
    });

    client.login(botToken);
}

main().catch(console.error);

