const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// 🌍 שרת אינטרנט בשביל Render כדי לשמור על הבוט דולק 24/7
http.createServer((req, res) => {
    res.write("Welcome Bot is running!");
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
        console.log(`Welcome Bot connected as ${client.user.tag}!`); 
    });

    // 🎈 אירוע שקורה בכל פעם שמשתמש חדש מצטרף לשרת
    client.on('guildMemberAdd', async (member) => {
        console.log(`${member.user.tag} הצטרף לשרת!`);

        // 1. שליחת הודעה פרטית (DM) למשתמש החדש
        try {
            await member.send(`ברוך הבא לשרת **${member.guild.name}**! 🎉 שמחים שהצטרפת אלינו, תהנה!`);
        } catch (err) {
            console.log("לא ניתן לשלוח הודעה פרטית למשתמש זה (הפרטיות שלו סגורה).");
        }

        // 2. שליחת הודעה כללית בערוץ הטקסט הראשי של השרת
        // הבוט יחפש אוטומטית את הערוץ הראשון שהוא יכול לכתוב בו (או ערוץ בשם "welcome")
        const welcomeChannel = member.guild.channels.cache.find(ch => ch.name.includes('welcome') || ch.name.includes('ברוכים-הבאים')) 
                               || member.guild.systemChannel;

        if (welcomeChannel) {
            welcomeChannel.send(`👋 ברוך הבא לשרת ${member}! שמחים לראות אותך כאן! 🎉`).catch(console.error);
        }
    });

    client.login(botToken);
}

main().catch(console.error);
