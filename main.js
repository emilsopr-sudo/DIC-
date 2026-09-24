const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Welcome & Member Count Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000);

async function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
}

// פונקציה שמעדכנת את מונה המשתמשים בערוץ הקולי
async function updateMemberCount(guild, channelId) {
    const memberCountChannel = guild.channels.cache.get(channelId);
    if (memberCountChannel) {
        // מביא את הכמות המדויקת של האנשים בשרת
        const totalMembers = guild.memberCount;
        await memberCountChannel.setName(`👥 חברים בשרת: ${totalMembers}`).catch(console.error);
        console.log(`מונה המשתמשים עודכן בהצלחה ל: ${totalMembers}`);
    } else {
        console.log("שגיאה: לא נמצא ערוץ מונה משתמשים עם ה-ID שסופק.");
    }
}

async function main() {
    const config = await loadConfig();
    
    // משיכת הטוקן בצורה מאובטחת מהאתר Render
    const botToken = config.token === "PROCESS_ENV_TOKEN" ? process.env.DISCORD_TOKEN : config.token;

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers, // 👥 חובה כדי לזהות כניסה ויציאה של משתמשים
            GatewayIntentBits.GuildMessages
        ]
    });

    client.once('ready', async () => { 
        console.log(`Bot connected as ${client.user.tag}!`); 
        
        // כשהבוט נדלק, הוא מעדכן את המונה פעם ראשונה בכל השרתים
        client.guilds.cache.forEach(async (guild) => {
            await updateMemberCount(guild, config.memberCountChannelId);
        });
    });

    // 🎈 אירוע 1: מישהו נכנס לשרת (שולח הודעות ומעדכן מונה)
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} הצטרף לשרת.`);

        // קישור התמונה שלך (הבאנר הסגול)
        const bannerUrl = 'https://cdn.discordapp.com/attachments/1552769614818058335/1552789243393343579/image.png?ex=6ab6e32d&is=6ab591ad&hm=902ff97601c1b774187fa1e6e9934f6dca6da1322dd4cf7177e975e10876d99b&';

        // א. שליחת הודעת ה-Embed בפרטי (DM)
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
        } catch (err) {
            console.log("לא ניתן לשלוח הודעה בפרטי (חסום).");
        }

        // ב. שליחת התמונה והתיוג בחדר השרת
        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
        if (welcomeChannel) {
            const imageEmbed = new EmbedBuilder().setColor('#5865F2').setImage(bannerUrl);
            await welcomeChannel.send({ embeds: [imageEmbed] }).catch(console.error);
            await welcomeChannel.send(`${member} ברוך הבא יעמה! מקווים שתהנה💜`).catch(console.error);
        }

        // ג. עדכון מונה המשתמשים כלפי מעלה
        await updateMemberCount(member.guild, config.memberCountChannelId);
    });

    // 🏃‍♂️ אירוע 2: מישהו עוזב את השרת (מעדכן מונה כלפי מטה)
    client.on('guildMemberRemove', async (member) => {
        console.log(`${member.user.tag} עזב את השרת.`);
        await updateMemberCount(member.guild, config.memberCountChannelId);
    });

    client.login(botToken);
}

main().catch(console.error);
