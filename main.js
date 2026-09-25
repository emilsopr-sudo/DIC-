```js
/*
  SFS BOT - Snapzy Frozi SL
  Node.js + discord.js v14
*/

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  Events,
} = require("discord.js");

const http = require("http");
const config = require("./config.json");

// ============================================================
// SETTINGS
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = Number(process.env.PORT) || 10000;
const COLOR = config.embedColor || "#5865F2";
const BANNER_URL = process.env.BANNER_URL || config.bannerUrl || "";

// ============================================================
// TOKEN CHECK
// ============================================================

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

// ============================================================
// DISCORD CLIENT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ============================================================
// MODERATION
// ============================================================

const BANNED_WORDS = new Set([
  "שרמוטה",
  "זונה",
  "מניאק",
  "קוקסינל",
  "נאצי",
  "כוסאמאק",
  "זין",
  "שרמוט",
  "fuck",
  "bitch",
  "asshole",
  "nigger",
  "nigga",
  "whore",
  "slut",
]);

const BANNED_PHRASES = [
  "בן זונה",
];

const INVITE_REGEX =
  /(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i;

// ============================================================
// CLEAR SESSIONS
// ============================================================

const clearSessions = new Map();

function startClearSession(channelId, userId) {
  const key = `${channelId}:${userId}`;

  const oldTimeout = clearSessions.get(key);
  if (oldTimeout) {
    clearTimeout(oldTimeout);
  }

  const timeout = setTimeout(() => {
    clearSessions.delete(key);
  }, 60 * 1000);

  clearSessions.set(key, timeout);
}

function hasClearSession(channelId, userId) {
  return clearSessions.has(`${channelId}:${userId}`);
}

function endClearSession(channelId, userId) {
  const key = `${channelId}:${userId}`;
  const timeout = clearSessions.get(key);

  if (timeout) {
    clearTimeout(timeout);
  }

  clearSessions.delete(key);
}

// ============================================================
// HELPERS
// ============================================================

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^\u05D0-\u05EAl.a-z0-9]+/i)
    .filter(Boolean);
}

function containsBannedContent(text) {
  const lower = String(text || "").toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return true;
    }
  }

  const words = tokenize(text);

  return words.some((word) => BANNED_WORDS.has(word));
}

async function safeDelete(message) {
  if (!message || !message.deletable) return;

  try {
    await message.delete();
  } catch (error) {
    console.error("⚠️ Message delete failed:", error.message);
  }
}

async function sendTemporary(channel, content, ms = 6000) {
  try {
    const message = await channel.send(content);

    setTimeout(() => {
      safeDelete(message).catch(() => {});
    }, ms);
  } catch (error) {
    console.error("⚠️ Temporary message failed:", error.message);
  }
}

function canUseClear(member) {
  if (!member) return false;

  if (
    member.permissions.has(
      PermissionsBitField.Flags.ManageMessages
    )
  ) {
    return true;
  }

  if (
    config.allowedClearRoleId &&
    member.roles.cache.has(config.allowedClearRoleId)
  ) {
    return true;
  }

  return false;
}

// ============================================================
// MEMBER COUNT
// ============================================================

async function updateMemberCount(guild) {
  if (!config.memberCountChannelId) return;

  try {
    const channel = guild.channels.cache.get(
      config.memberCountChannelId
    );

    if (!channel) {
      console.error(
        "⚠️ Member count channel not found."
      );
      return;
    }

    const newName = `👥 חברים בשרת: ${guild.memberCount}`;

    if (
      channel.name !== newName &&
      typeof channel.setName === "function"
    ) {
      await channel.setName(newName);
    }
  } catch (error) {
    console.error(
      "⚠️ Member counter update failed:",
      error.message
    );
  }
}

// ============================================================
// WELCOME EMBED
// ============================================================

function createWelcomeEmbed(member) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🇮🇱 ברוכים הבאים ל-SFS 🇮🇱")
    .setDescription(
      `היי ${member}, כיף שהצטרפת ל-**Snapzy Frozi SL**! 💜\n\n` +
      `כאן זה הבית של הקהילה שלנו — גיימינג, צ'אט ובלגן טוב. 🔥\n\n` +
      `📜 **חוקים:** <#${config.rulesChannelId}>\n` +
      `💬 **צ'אט ראשי:** <#${config.generalChannelId}>\n\n` +
      `תרגיש בבית ותיהנה! ❤️`
    )
    .setThumbnail(
      member.user.displayAvatarURL({
        size: 256,
      })
    )
    .setFooter({
      text: "SFS — Snapzy Frozi SL",
    })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

// ============================================================
// HELP EMBED
// ============================================================

function createHelpEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📖 SFS Bot — עזרה")
    .setDescription(
      "🧹 **ניקוי** — ניקוי הודעות\n" +
      "🏓 **!ping** — בדיקת פינג\n" +
      "🏠 **!server** — מידע על השרת\n" +
      "📖 **!help** — הצגת עזרה\n\n" +
      "🛡️ Auto-Mod פעיל\n" +
      "🚫 Anti-Invite פעיל\n" +
      "🎈 Welcome פעיל\n" +
      "👥 Member Counter פעיל"
    )
    .setFooter({
      text: "SFS — Snapzy Frozi SL",
    });
}

// ============================================================
// SERVER EMBED
// ============================================================

function createServerEmbed(guild) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`🏠 ${guild.name}`)
    .addFields(
      {
        name: "👥 חברים",
        value: String(guild.memberCount),
        inline: true,
      },
      {
        name: "💬 ערוצים",
        value: String(guild.channels.cache.size),
        inline: true,
      },
      {
        name: "🆔 Server ID",
        value: guild.id,
      }
    )
    .setTimestamp();

  const icon = guild.iconURL({
    size: 256,
  });

  if (icon) {
    embed.setThumbnail(icon);
  }

  return embed;
}

// ============================================================
// BOT READY
// ============================================================

client.once(Events.ClientReady, async (bot) => {
  console.log("========================================");
  console.log("✅ SFS BOT IS ONLINE");
  console.log(`🤖 Logged in as: ${bot.user.tag}`);
  console.log(`🆔 Bot ID: ${bot.user.id}`);
  console.log(`🏠 Servers: ${bot.guilds.cache.size}`);
  console.log("========================================");

  for (const guild of bot.guilds.cache.values()) {
    await updateMemberCount(guild);
  }
});

// ============================================================
// WELCOME
// ============================================================

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const channel = member.guild.channels.cache.get(
      config.welcomeChannelId
    );

    if (
      channel &&
      typeof channel.send === "function"
    ) {
      await channel.send({
        embeds: [createWelcomeEmbed(member)],
      });

      await sendTemporary(
        channel,
        `${member} ברוך הבא ל-SFS! 💜`,
        8000
      );
    } else {
      console.error(
        "⚠️ Welcome channel not found."
      );
    }

    try {
      await member.send({
        embeds: [createWelcomeEmbed(member)],
      });
    } catch {
      // DMs disabled.
    }

    await updateMemberCount(member.guild);
  } catch (error) {
    console.error(
      "⚠️ Welcome system failed:",
      error.message
    );
  }
});

// ============================================================
// MEMBER LEAVE
// ============================================================

client.on(Events.GuildMemberRemove, async (member) => {
  await updateMemberCount(member.guild);
});

// ============================================================
// MESSAGE HANDLER
// ============================================================

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content.trim();
    const channelId = message.channel.id;
    const userId = message.author.id;

    // --------------------------------------------------------
    // CLEAR ANSWER
    // --------------------------------------------------------

    if (
      hasClearSession(
        channelId,
        userId
      )
    ) {
      const amount = Number(content);

      endClearSession(
        channelId,
        userId
      );

      if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 100
      ) {
        await safeDelete(message);

        await sendTemporary(
          message.channel,
          "❌ התהליך בוטל. כתוב מספר בין 1 ל-100."
        );

        return;
      }

      try {
        const deleted =
          await message.channel.bulkDelete(
            amount,
            true
          );

        await safeDelete(message);

        await sendTemporary(
          message.channel,
          `🧹 נמחקו ${deleted.size} הודעות בהצלחה.`
        );
      } catch (error) {
        console.error(
          "⚠️ Bulk delete failed:",
          error.message
        );

        await safeDelete(message);

        await sendTemporary(
          message.channel,
          "❌ לא הצלחתי למחוק את ההודעות."
        );
      }

      return;
    }

    // --------------------------------------------------------
    // NIKUI
    // --------------------------------------------------------

    if (content === "ניקוי") {
      if (!canUseClear(message.member)) {
        await sendTemporary(
          message.channel,
          "❌ אין לך הרשאה להשתמש בפקודה הזו.",
          5000
        );

        return;
      }

      startClearSession(
        channelId,
        userId
      );

      await sendTemporary(
        message.channel,
        "🧹 כמה הודעות למחוק?\nיש לך דקה לענות.\nכתוב מספר בין 1 ל-100.",
        15000
      );

      return;
    }

    // --------------------------------------------------------
    // PING
    // --------------------------------------------------------

    if (content === "!ping") {
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setDescription(
              `🏓 Pong! \`${client.ws.ping}ms\``
            ),
        ],
      });

      return;
    }

    // --------------------------------------------------------
    // SERVER
    // --------------------------------------------------------

    if (content === "!server") {
      await message.channel.send({
        embeds: [
          createServerEmbed(
            message.guild
          ),
        ],
      });

      return;
    }

    // --------------------------------------------------------
    // HELP
    // --------------------------------------------------------

    if (content === "!help") {
      await message.channel.send({
        embeds: [
          createHelpEmbed(),
        ],
      });

      return;
    }

    // --------------------------------------------------------
    // ANTI INVITE
    // --------------------------------------------------------

    if (
      INVITE_REGEX.test(content) &&
      !canUseClear(message.member)
    ) {
      await safeDelete(message);

      await sendTemporary(
        message.channel,
        `${message.author} 🚫 אסור לפרסם הזמנות לשרתים אחרים כאן.`,
        6000
      );

      return;
    }

    // --------------------------------------------------------
    // AUTO MOD
    // --------------------------------------------------------

    if (containsBannedContent(content)) {
      await safeDelete(message);

      await sendTemporary(
        message.channel,
        `${message.author} ⚠️ שים לב לשפה שלך בבקשה.`,
        6000
      );
    }

  } catch (error) {
    console.error(
      "⚠️ Message handler failed:",
      error.message
    );
  }
});

// ============================================================
// ERRORS
// ============================================================

client.on("error", (error) => {
  console.error(
    "❌ Discord client error:",
    error.message
  );
});

client.on("warn", (message) => {
  console.warn(
    "⚠️ Discord warning:",
    message
  );
});

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "❌ Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);

// ============================================================
// RENDER HTTP SERVER
// ============================================================

const server = http.createServer(
  (_req, res) => {
    res.writeHead(200, {
      "Content-Type":
        "text/plain; charset=utf-8",
    });

    res.end(
      "SFS Bot is running!"
    );
  }
);

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `🌐 HTTP server listening on port ${PORT}`
    );
  }
);

// ============================================================
// LOGIN
// ============================================================

console.log(
  "🔌 Connecting to Discord..."
);

client.login(TOKEN).catch(
  (error) => {
    console.error(
      "========================================"
    );

    console.error(
      "❌ DISCORD LOGIN FAILED"
    );

    console.error(
      `❌ ${error.message}`
    );

    console.error(
      "========================================"
    );

    process.exit(1);
  }
);
```
