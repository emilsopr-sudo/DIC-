const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Welcome & Member Count Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000, () => {
    console.log("Web server is alive!");
});

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

    // ⚙️ הגדרת כל האישורים הנדרשים כדי למנוע קריסה של הבוט
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers, // 👥 חובה לכניסה ויציאה
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

    // 🎈 אירוע כניסת משתמש
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} נכנס לשרת.`);
        const bannerUrl = 'תדביק_כאן_את_הקישור_של_התמונה_מדיסקורד';

        // 1. הודעה בפרטי
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

        // 3. עדכון מונה
        updateMemberCount(member.guild, config.memberCountChannelId);
    });

    // 🏃‍♂️ אירוע עזיבת משתמש
    client.on('guildMemberRemove', async (member) => {
        console.log(`${member.user.tag} עזב.`);
        updateMemberCount(member.guild, config.memberCountChannelId);
    });

    client.login(botToken);
}

main().catch(console.error);
