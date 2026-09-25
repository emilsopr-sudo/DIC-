const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');

const http = require('http');

// ============================================================
// 🔐 ENV
// ============================================================

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const BANNER_URL = process.env.BANNER_URL || "";

// ============================================================
// 🆔 SFS CHANNELS / ROLE
// ============================================================

const WELCOME_CHANNEL_ID = "1552769580856909938";
const MEMBER_COUNT_CHANNEL_ID = "1552806717308543046";
const RULES_CHANNEL_ID = "1552769582278648009";
const GENERAL_CHANNEL_ID = "1552769587408543927";

const ALLOWED_CLEAR_ROLE_ID = "1552769521885118494";

// ============================================================
// 🌐 RENDER WEB SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("SFS Safe Multi-Bot is running!");
}).listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// ============================================================
// ❌ TOKEN CHECK
// ============================================================

if (!BOT_TOKEN) {
    console.error("❌ DISCORD_TOKEN לא נמצא ב-Environment Variables.");
    process.exit(1);
}

// ============================================================
// 🤖 CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================================================
// 🤬 BANNED WORDS
// ============================================================

const bannedWords = [
    "שרמוטה",
    "זונה",
    "מניאק",
    "קוקסינל",
    "נאצי",
    "כוסאמאק",
    "זין",
    "שרמוט",
    "בן זונה",

    "fuck",
    "bitch",
    "asshole",
    "nigger",
    "nigga",
    "whore",
    "slut"
];

const escapeRegex = (text) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const bannedWordsRegex = new RegExp(
    "(^|[^א-תa-zA-Z0-9])(" +
        bannedWords.map(escapeRegex).join("|") +
        ")($|[^א-תa-zA-Z0-9])",
    "i"
);

// ============================================================
// 🧹 CLEAR SESSIONS
// ============================================================

const activeClears = new Map();

const CLEAR_SESSION_TIMEOUT_MS = 60 * 1000;

function getSessionKey(userId, channelId) {
    return `${userId}-${channelId}`;
}

function startClearSession(sessionKey) {
    const oldTimer = activeClears.get(sessionKey);

    if (oldTimer) {
        clearTimeout(oldTimer);
    }

    const timer = setTimeout(() => {
        activeClears.delete(sessionKey);
    }, CLEAR_SESSION_TIMEOUT_MS);

    activeClears.set(sessionKey, timer);
}

function endClearSession(sessionKey) {
    const timer = activeClears.get(sessionKey);

    if (timer) {
        clearTimeout(timer);
    }

    activeClears.delete(sessionKey);
}

// ============================================================
// 👑 CLEAR PERMISSION
// ============================================================

function canUseClear(member) {
    if (!member) return false;

    if (
        member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        )
    ) {
        return true;
    }

    return member.roles.cache.has(
        ALLOWED_CLEAR_ROLE_ID
    );
}

// ============================================================
// 👥 MEMBER COUNT
// ============================================================

async function updateMemberCount(guild) {
    try {
        const channel = await guild.channels
            .fetch(MEMBER_COUNT_CHANNEL_ID)
            .catch(() => null);

        if (!channel) {
            console.log(
                `⚠️ Member count channel not found in ${guild.name}`
            );
            return;
        }

        if (!channel.manageable) {
            console.log(
                `❌ Cannot rename member count channel in ${guild.name}`
            );
            return;
        }

        await channel.setName(
            `👥 חברים בשרת: ${guild.memberCount}`
        );

    } catch (error) {
        console.error(
            "❌ שגיאה בעדכון מונה:",
            error.message
        );
    }
}

// ============================================================
// ✅ READY
// ============================================================

client.once("ready", async () => {
    console.log("");
    console.log("==================================================");
    console.log("🔥 SFS BOT ONLINE");
    console.log("==================================================");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🆔 ID: ${client.user.id}`);
    console.log(`🏠 Servers: ${client.guilds.cache.size}`);
    console.log("🛡️ Auto-Mod: ON");
    console.log("🚫 Anti-Invite: ON");
    console.log("🧹 Clear: ON");
    console.log("🎈 Welcome: ON");
    console.log("👥 Member Counter: ON");
    console.log("==================================================");
    console.log("");

    for (const guild of client.guilds.cache.values()) {
        await updateMemberCount(guild);
    }
});

// ============================================================
// 🎈 WELCOME
// ============================================================

client.on("guildMemberAdd", async (member) => {
    const welcomeEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🇮🇱 ברוכים הבאים ל-SFS 🇮🇱")
        .setDescription(
            `👋 אהלן ${member} וברוך הבא לשרת הרשמי של **SFS**!\n\n` +
            `תפסו כיסא בפרלמנט, תכינו קפה ותתחילו להכיר אנשים.\n` +
            `כאן לא עושים פוזות, כולם מדברים עם כולם.\n\n` +
            `**לפני שאתה קופץ למים, תעשה סיבוב קצר:**\n\n` +
            `📜 ספר החוקים — <#${RULES_CHANNEL_ID}>\n` +
            `💬 צ'אט ראשי — <#${GENERAL_CHANNEL_ID}>\n\n` +
            `יאללה, בלי להתבייש. תהנו! 💜`
        )
        .setThumbnail(
            member.user.displayAvatarURL({
                extension: "png",
                size: 256
            })
        )
        .setTimestamp();

    if (BANNER_URL) {
        welcomeEmbed.setImage(BANNER_URL);
    }

    // --------------------------------------------------------
    // 📩 DM
    // --------------------------------------------------------

    try {
        await member.send({
            embeds: [welcomeEmbed]
        });
    } catch (error) {
        // DM חסום / נכשל - לא מפיל את הבוט
    }

    // --------------------------------------------------------
    // 📢 Welcome Channel
    // --------------------------------------------------------

    try {
        const welcomeChannel = await member.guild.channels
            .fetch(WELCOME_CHANNEL_ID)
            .catch(() => null);

        if (welcomeChannel) {
            await welcomeChannel.send({
                embeds: [welcomeEmbed]
            });

            const welcomeMessage = await welcomeChannel.send(
                `${member} ברוך הבא יעמה! מקווים שתהנה 💜`
            );

            setTimeout(() => {
                welcomeMessage.delete().catch(() => {});
            }, 8000);
        }
    } catch (error) {
        console.error(
            "❌ Welcome error:",
            error.message
        );
    }

    await updateMemberCount(member.guild);
});

// ============================================================
// 🚪 MEMBER LEAVE
// ============================================================

client.on("guildMemberRemove", async (member) => {
    await updateMemberCount(member.guild);
});

// ============================================================
// 🛡️ MESSAGE CREATE
// ============================================================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const hasClearPermission = canUseClear(
        message.member
    );

    // ========================================================
    // 🤬 AUTO-MOD
    // ========================================================

    if (!hasClearPermission) {
        const content = message.content.toLowerCase();

        // ----------------------------------------------------
        // קללות
        // ----------------------------------------------------

        if (bannedWordsRegex.test(content)) {
            await message.delete().catch(() => {});

            try {
                const warning = await message.channel.send(
                    `⚠️ ${message.author}, שמור על השפה שלך! ` +
                    `אסור לקלל בשרת הזה. ❌`
                );

                setTimeout(() => {
                    warning.delete().catch(() => {});
                }, 4000);
            } catch (error) {}

            return;
        }

        // ----------------------------------------------------
        // 🚫 DISCORD INVITES
        // ----------------------------------------------------

        const inviteRegex =
            /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/i;

        if (inviteRegex.test(content)) {
            await message.delete().catch(() => {});

            try {
                const warning = await message.channel.send(
                    `🚫 ${message.author}, חל איסור מוחלט ` +
                    `לפרסם שרתי דיסקורד אחרים! ❌`
                );

                setTimeout(() => {
                    warning.delete().catch(() => {});
                }, 4000);
            } catch (error) {}

            return;
        }
    }

    // ========================================================
    // 🧹 ניקוי
    // ========================================================

    const sessionKey = getSessionKey(
        message.author.id,
        message.channel.id
    );

    // --------------------------------------------------------
    // מישהו כתב "ניקוי"
    // --------------------------------------------------------

    if (message.content.trim() === "ניקוי") {
        if (!hasClearPermission) {
            try {
                const reply = await message.reply(
                    "אין לך הרשאה להשתמש במערכת הניקוי! ❌"
                );

                setTimeout(() => {
                    reply.delete().catch(() => {});
                    message.delete().catch(() => {});
                }, 3000);
            } catch (error) {}

            return;
        }

        startClearSession(sessionKey);

        await message.reply(
            "כמה? 🤔\n" +
            "יש לך **דקה** לענות.\n" +
            "כתוב מספר בין **1 ל-100**."
        );

        return;
    }

    // --------------------------------------------------------
    // יש session פעיל
    // --------------------------------------------------------

    if (activeClears.has(sessionKey)) {
        const text = message.content.trim();

        // אם זה לא מספר - ממשיכים לחכות
        if (!/^\d+$/.test(text)) {
            return;
        }

        const amount = parseInt(text, 10);

        endClearSession(sessionKey);

        // ----------------------------------------------------
        // בדיקת מספר
        // ----------------------------------------------------

        if (amount < 1 || amount > 100) {
            try {
                const reply = await message.reply(
                    "❌ התהליך בוטל.\n" +
                    "בחר מספר בין **1 ל-100**."
                );

                setTimeout(() => {
                    reply.delete().catch(() => {});
                }, 4000);
            } catch (error) {}

            return;
        }

        // ----------------------------------------------------
        // 🧹 מחיקה
        // ----------------------------------------------------

        try {
            const deletedMessages =
                await message.channel.bulkDelete(
                    amount,
                    true
                );

            const deletedCount =
                deletedMessages.size;

            const result =
                await message.channel.send(
                    `🧹 ניקיתי בהצלחה **${deletedCount}** הודעות!`
                );

            setTimeout(() => {
                result.delete().catch(() => {});
            }, 3000);

        } catch (error) {
            console.error(
                "❌ Clear error:",
                error.message
            );

            try {
                await message.channel.send(
                    "❌ לא הצלחתי לבצע את הניקוי. " +
                    "בדוק שיש לי הרשאת **Manage Messages** " +
                    "ושההודעות לא ישנות מדי."
                );
            } catch (sendError) {}
        }

        return;
    }
});

// ============================================================
// 🏓 PING
// ============================================================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content === "!ping") {
        const ping = Math.round(
            client.ws.ping
        );

        await message.reply(
            `🏓 **Pong!** \`${ping}ms\``
        );
    }
});

// ============================================================
// 🏠 SERVER INFO
// ============================================================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content === "!server") {
        const guild = message.guild;

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`🇮🇱 ${guild.name}`)
            .addFields(
                {
                    name: "👥 חברים",
                    value: `${guild.memberCount}`,
                    inline: true
                },
                {
                    name: "💬 ערוצים",
                    value: `${guild.channels.cache.size}`,
                    inline: true
                },
                {
                    name: "🆔 Server ID",
                    value: `${guild.id}`,
                    inline: false
                }
            )
            .setTimestamp();

        if (guild.iconURL()) {
            embed.setThumbnail(
                guild.iconURL({
                    extension: "png",
                    size: 256
                })
            );
        }

        await message.reply({
            embeds: [embed]
        });
    }
});

// ============================================================
// 📖 HELP
// ============================================================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.content === "!help") {
        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🤖 SFS Bot")
            .setDescription(
                "**מערכות פעילות:**\n\n" +
                "🧹 `ניקוי` — ניקוי הודעות\n" +
                "🏓 `!ping` — בדיקת פינג\n" +
                "🏠 `!server` — מידע על השרת\n\n" +
                "🛡️ Auto-Mod פעיל\n" +
                "🚫 Anti-Invite פעיל\n" +
                "🎈 Welcome פעיל\n" +
                "👥 Member Counter פעיל"
            );

        await message.reply({
            embeds: [embed]
        });
    }
});

// ============================================================
// ❌ DISCORD ERROR
// ============================================================

client.on("error", (error) => {
    console.error(
        "❌ Discord client error:",
        error
    );
});

// ============================================================
// 🚀 LOGIN
// ============================================================

client.login(BOT_TOKEN);
