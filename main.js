const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Welcome Bot SFS DM is running!");
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
        console.log(`Welcome Bot SFS DM connected as ${client.user.tag}!`); 
    });

    // 🎈 אירוע שקורה בכל פעם שמשתמש חדש מצטרף לשרת
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} הצטרף לשרת. שולח הודעה בפרטי...`);

        // 🏙️ יצירת תיבת הודעה מעוצבת וצבעונית (Embed) עם הטקסט המעודכן שלך
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2') // צבע סגול יפה בצד ההודעה
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
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true })) // תמונת הפרופיל של המשתמש
            // 🖼️ הצגת הבאנר המעוצב שלך בתחתית ההודעה הפרטית
            .setImage('https://cdn.discordapp.com/attachments/1552769614818058335/1552789243393343579/image.png?ex=6ab6e32d&is=6ab591ad&hm=902ff97601c1b774187fa1e6e9934f6dca6da1322dd4cf7177e975e10876d99b&')
            .setTimestamp();

        // 🚀 שליחה ישירה להודעות הפרטיות (DM) של המשתמש החדש
        try {
            await member.send({ embeds: [welcomeEmbed] });
            console.log(`הודעת ברוך הבא נשלחה בהצלחה בפרטי ל-${member.user.tag}`);
        } catch (err) {
            // שגיאה שיכולה לקרות רק אם המשתמש חסם קבלת הודעות פרטיות מאנשים בשרת
            console.log(`לא ניתן לשלוח הודעה פרטית ל-${member.user.tag} כי הגדרות הפרטיות שלו חסומות.`);
        }
    });

    client.login(botToken);
}

main().catch(console.error);
