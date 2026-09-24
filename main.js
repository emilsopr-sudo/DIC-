const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Welcome Bot SFS is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

async function main() {
    const config = await loadConfig();
    
    // משיכת הטוקן בצורה מאובטחת מהאתר Render
    const botToken = config.token === "PROCESS_ENV_TOKEN" ? process.env.DISCORD_TOKEN : config.token;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers, // 👥 חובה כדי לזהות שמשתמש חדש נכנס
            GatewayIntentBits.GuildMessages
        ]
    });

    client.once('ready', () => { 
        console.log(`Welcome Bot SFS connected as ${client.user.tag}!`); 
    });

    // 🎈 אירוע שקורה בכל פעם שמשתמש חדש מצטרף לשרת
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} הצטרף לשרת SFS!`);

        // 🏙️ יצירת תיבת הודעה מעוצבת וצבעונית (Embed) עם הטקסט שלך
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2') // צבע סגול יפה בצד ההודעה
            .setTitle('🇮🇱 ברוכים הבאים ל-SFS 🇮🇱')
            .setDescription(
                `👋 אהלן ${member} וברוך הבא לשרת הרשמי של SFS!\n\n` +
                `תפסו כיסא בפרלמנט, תכינו קפה ותתחילו להכיר אנשים.\n` +
                `כאן לא עושים פוזות, כולם מדברים עם כולם.\n\n` +
                `לפני שאתה קופץ למים, תעשה סיבוב קצר:\n` +
                `📜 תראה מה מותר ומה אסור ב-ספר-החוקים\n` +
                `🎭 תבחר מה מעניין אותך ב-קח-רול\n` +
                `💬 ובוא להגיד שלום ב-הכיכר-המרכזית\n\n` +
                `יאללה, בלי להתבייש. תהנו! 💜`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true })) // מציג את תמונת הפרופיל של המשתמש
            .setTimestamp();

        // 🔍 מציאת החדר המדויק לפי ה-ID ששמנו בקובץ config.json
        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);

        // 🚀 שליחת ההודעה המעוצבת לערוץ הנבחר
        if (welcomeChannel) {
            welcomeChannel.send({ embeds: [welcomeEmbed] }).catch(console.error);
        } else {
            console.log("שגיאה: לא נמצא חדר עם ה-ID שסיפקת בקובץ ההגדרות. שולח לערוץ ברירת המחדל.");
            if (member.guild.systemChannel) {
                member.guild.systemChannel.send({ embeds: [welcomeEmbed] }).catch(console.error);
            }
        }
    });

    client.login(botToken);
}

main().catch(console.error);
