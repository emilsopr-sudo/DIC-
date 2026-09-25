```js
// ============================================================
// SFS BOT — Snapzy Frozi SL
// Discord.js v14 + Node.js
// ============================================================

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
  console.error("❌ ERROR: DISCORD_TOKEN is missing!");
  console.error("Go to Render → Environment and add DISCORD_TOKEN.");
  process.exit(1);
}

console.log("🔑 DISCORD_TOKEN found.");
console.log("🚀 Starting SFS Bot...");

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
// BANNED WORDS
// ============================================================

const BANNED_WORDS = [
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
];

const BANNED_PHRASES = [
  "בן זונה",
];

const INVITE_REGEX =
  /(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i;

// ============================================================
// HELPERS
// ============================================================

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^\u05D0-\u05EAa-zA-Z0-9]+/)
    .filter(Boolean);
}

function containsBannedContent(text) {
  if (!text) return false;

  const lower = text.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return true;
    }
  }

  const words = tokenize(text);

  return words.some((word) =>
    BANNED_WORDS.includes(word)
  );
}

async function deleteMessage(message) {
  if (!message || !message.deletable) return;

  try {
    await message.delete();
  } catch (error) {
    console.error("⚠️ Could not delete message:", error.message);
  }
}

async function temporaryMessage(channel, text, time = 6000) {
  try {
    const msg = await channel.send(text);

    setTimeout(async () => {
      await deleteMessage(msg);
    }, time);
  } catch (error) {
    console.error("⚠️ Could not send message:", error.message);
  }
}

function canUseClear(member) {
  if (!member) return false;

  // Manage Messages permission
  if (
    member.permissions.has(
      PermissionsBitField.Flags.ManageMessages
    )
  ) {
    return true;
  }

  // Specific role from config
  if (
    config.allowedClearRoleId &&
    member.roles.cache.has(config.allowedClearRoleId)
  ) {
    return true;
  }

  return false;
}

// ============================================================
// MEMBER COUNTER
// ============================================================

async function updateMemberCount(guild) {
  try {
    if (!config.memberCountChannelId) return;

    const channel = guild.channels.cache.get(
      config.memberCountChannelId
    );

    if (!channel) {
      console.error(
        "⚠️ Member count channel not found:",
        config.memberCountChannelId
      );
      return;
    }

    const newName = `👥 חברים בשרת: ${guild.memberCount}`;

    if (channel.name === newName) return;

    await channel.setName(newName);

    console.log(
      `👥 Member counter updated: ${guild.memberCount}`
    );
  } catch (error) {
    console.error(
      "⚠️ Member counter error:",
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
      `כאן זה הבית של הקהילה שלנו — גיימינג, צ'אטים ובלגן טוב. 🔥\n\n` +
      `📜 **חוקים:** <#${config.rulesChannelId}>\n` +
      `💬 **צ'אט:** <#${config.generalChannelId}>\n\n` +
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
// WELCOME
// ============================================================

client.on(Events.GuildMemberAdd, async (member) => {
  console.log(
    `👋 New member: ${member.user.tag}`
  );

  try {
    const channel = member.guild.channels.cache.get(
      config.welcomeChannelId
    );

    if (channel) {
      const embed = createWelcomeEmbed(member);

      await channel.send({
        embeds: [embed],
      });

      await temporaryMessage(
        channel,
        `${member} ברוך הבא ל-SFS! 💜`,
        8000
      );
    } else {
      console.error(
        "❌ Welcome channel not found!"
      );
    }

    // Try DM
    try {
      await member.send({
        embeds: [createWelcomeEmbed(member)],
      });
    } catch {
      console.log(
        `ℹ️ Could not DM ${member.user.tag}`
      );
    }

    await updateMemberCount(member.guild);

  } catch (error) {
    console.error(
      "❌ Welcome system error:",
      error.message
    );
  }
});

// ============================================================
// MEMBER LEAVE
// ============================================================

client.on(Events.GuildMemberRemove, async (member) => {
  console.log(
    `👋 Member left: ${member.user.tag}`
  );

  await updateMemberCount(member.guild);
});

// ============================================================
// CLEAR SYSTEM
// ============================================================

const clearSessions = new Map();

function sessionKey(channelId, userId) {
  return `${channelId}-${userId}`;
}

function startClear(channelId, userId) {
  const key = sessionKey(channelId, userId);

  if (clearSessions.has(key)) {
    clearTimeout(clearSessions.get(key));
  }

  const timeout = setTimeout(() => {
    clearSessions.delete(key);
  }, 60000);

  clearSessions.set(key, timeout);
}

function stopClear(channelId, userId) {
  const key = sessionKey(channelId, userId);

  if (clearSessions.has(key)) {
    clearTimeout(clearSessions.get(key));
  }

  clearSessions.delete(key);
}

function hasClearSession(channelId, userId) {
  return clearSessions.has(
    sessionKey(channelId, userId)
  );
}

// ============================================================
// EMBEDS
// ============================================================

function pingEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setDescription(
      `🏓 Pong! \`${client.ws.ping}ms\``
    );
}

function serverEmbed(guild) {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`🏠 ${guild.name}`)
    .setThumbnail(
      guild.iconURL({
        size: 256,
      })
    )
    .addFields(
      {
        name: "👥 חברים",
        value: `${guild.memberCount}`,
        inline: true,
      },
      {
        name: "💬 ערוצים",
        value: `${guild.channels.cache.size}`,
        inline: true,
      },
      {
        name: "🆔 Server ID",
        value: guild.id,
      }
    )
    .setTimestamp();
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📖 SFS Bot — עזרה")
    .setDescription(
      "🧹 **ניקוי** — מחיקת הודעות\n" +
      "🏓 **!ping** — בדיקת פינג\n" +
      "🏠 **!server** — מידע על השרת\n" +
      "📖 **!help** — הצגת הפקודות\n\n" +
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

    if (hasClearSession(channelId, userId)) {
      const amount = Number(content);

      stopClear(channelId, userId);

      if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 100
      ) {
        await temporaryMessage(
          message.channel,
          "❌ התהליך בוטל.\nכתוב מספר בין 1 ל-100.",
          6000
        );

        await deleteMessage(message);
        return;
      }

      try {
        const deleted =
          await message.channel.bulkDelete(
            amount,
            true
          );

        await deleteMessage(message);

        await temporaryMessage(
          message.channel,
          `🧹 נמחקו ${deleted.size} הודעות בהצלחה.`,
          6000
        );
      } catch (error) {
        console.error(
          "❌ Clear error:",
          error.message
        );

        await temporaryMessage(
          message.channel,
          "❌ לא הצלחתי למחוק את ההודעות.",
          6000
        );
      }

      return;
    }

    // --------------------------------------------------------
    // ניקוי
    // --------------------------------------------------------

    if (content === "ניקוי") {
      if (!canUseClear(message.member)) {
        await temporaryMessage(
          message.channel,
          "❌ אין לך הרשאה להשתמש בפקודה הזו.",
          5000
        );

        return;
      }

      startClear(channelId, userId);

      await temporaryMessage(
        message.channel,
        "🧹 כמה הודעות למחוק?\n\nיש לך דקה לענות.\nכתוב מספר בין **1 ל-100**.",
        15000
      );

      return;
    }

    // --------------------------------------------------------
    // !ping
    // --------------------------------------------------------

    if (content === "!ping") {
      await message.channel.send({
        embeds: [pingEmbed()],
      });

      return;
    }

    // --------------------------------------------------------
    // !server
    // --------------------------------------------------------

    if (content === "!server") {
      await message.channel.send({
        embeds: [
          serverEmbed(message.guild),
        ],
      });

      return;
    }

    // --------------------------------------------------------
    // !help
    // --------------------------------------------------------

    if (content === "!help") {
      await message.channel.send({
        embeds: [helpEmbed()],
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
      await deleteMessage(message);

      await temporaryMessage(
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
      await deleteMessage(message);

      await temporaryMessage(
        message.channel,
        `${message.author} ⚠️ שים לב לשפה שלך בבקשה.`,
        6000
      );

      return;
    }

  } catch (error) {
    console.error(
      "❌ Message handler error:",
      error.message
    );
  }
});

// ============================================================
// BOT READY
// ============================================================

client.once(Events.ClientReady, async (bot) => {
  console.log("");
  console.log("====================================");
  console.log("✅ SFS BOT IS ONLINE!");
  console.log(`🤖 Logged in as: ${bot.user.tag}`);
  console.log(`🆔 Bot ID: ${bot.user.id}`);
  console.log(`🏠 Servers: ${bot.guilds.cache.size}`);
  console.log("====================================");
  console.log("");

  for (const guild of bot.guilds.cache.values()) {
    try {
      await guild.members.fetch();
    } catch (error) {
      console.error(
        `⚠️ Could not fetch members for ${guild.name}:`,
        error.message
      );
    }

    await updateMemberCount(guild);
  }
});

// ============================================================
// DISCORD ERRORS
// ============================================================

client.on("error", (error) => {
  console.error(
    "❌ Discord Client Error:",
    error.message
  );
});

client.on("warn", (message) => {
  console.warn(
    "⚠️ Discord Warning:",
    message
  );
});

process.on("unhandledRejection", (error) => {
  console.error(
    "❌ Unhandled Promise Rejection:",
    error
  );
});

process.on("uncaughtException", (error) => {
  console.error(
    "❌ Uncaught Exception:",
    error
  );
});

// ============================================================
// RENDER HTTP SERVER
// ============================================================

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.end("SFS Bot is running!");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🌐 Render HTTP server running on port ${PORT}`
  );
});

// ============================================================
// LOGIN
// ============================================================

console.log("🔌 Connecting to Discord...");

client
  .login(TOKEN)
  .then(() => {
    console.log("✅ Discord login successful!");
  })
  .catch((error) => {
    console.error("");
    console.error("====================================");
    console.error("❌ DISCORD LOGIN FAILED");
    console.error("====================================");
    console.error("Error:", error.message);
    console.error("");
    console.error(
      "Check that DISCORD_TOKEN in Render is correct."
    );
    console.error("");
    process.exit(1);
  });
```
