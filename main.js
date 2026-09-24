const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Welcome Bot SFS Custom is running!");
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
        console.log(`Welcome Bot SFS Custom connected as ${client.user.tag}!`); 
    });

    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} הצטרף לשרת. מפעיל מערכת ברכות משולבת...`);

        // קישור התמונה שלך (הבאנר הסגול) שיופיע גם בפרטי וגם בחדר השרת
        const bannerUrl = 'https://cdn.discordapp.com/attachments/1552769614818058335/1552789243393343579/image.png?ex=6ab6e32d&is=6ab591ad&hm=902ff97601c1b774187fa1e6e9934f6dca6da1322dd4cf7177e975e10876d99b&';

        // ==========================================
        // חלק 1: שליחת הודעת הטקסט המעוצבת בפרטי (DM)
        // ==========================================
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

        try {
            await member.send({ embeds: [welcomeEmbed] });
            console.log(`הודעת ה-Embed נשלחה בהצלחה בפרטי ל-${member.user.tag}`);
        } catch (err) {
            console.log(`לא ניתן לשלוח הודעה פרטית ל-${member.user.tag} (פרטיות חסומה).`);
        }

        // ==========================================
        // חלק 2: שליחת התמונה והתיוג בחדר הנבחר בשרת
        // ==========================================
        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);

        if (welcomeChannel) {
            // א. יצירת תיבה פשוטה רק בשביל להציג את התמונה בחדר
            const imageEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setImage(bannerUrl);

            // ב. שליחת התמונה לחדר
            await welcomeChannel.send({ embeds: [imageEmbed] }).catch(console.error);

            // ג. שליחת הודעת התיוג המיוחדת שלך מיד מתחת לתמונה
            await welcomeChannel.send(`${member} ברוך הבא יעמה! מקווים שתהנה💜`).catch(console.error);
            console.log(`הבאנר והתיוג נשלחו בהצלחה בחדר השרת!`);
        } else {
            console.log("שגיאה: לא נמצא חדר עם ה-ID שסיפקת בקובץ config.json");
        }
    });

    client.login(botToken);
}

main().catch(console.error);

