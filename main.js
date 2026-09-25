/* ============================================================
   SFS BOT — Snapzy Frozi SL Community Discord Bot
   Node.js + discord.js v14 (CommonJS)
   ============================================================ */

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  Events,
} = require("discord.js");
const http = require("http");
const config = require("./config.json");

/* ============================================================
   SECTION: Environment / Token
   ============================================================ */

const TOKEN = process.env.DISCORD_TOKEN;
const BANNER_URL = process.env.BANNER_URL || config.bannerUrl || "";

if (!TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN environment variable. Set it in Render's Environment tab.");
  process.exit(1);
}

/* ============================================================
   SECTION: Client Setup
   ============================================================ */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

/* ============================================================
   SECTION: Constants — Auto-Mod word lists & patterns
   ============================================================ */

// Exact-word banned list (checked against whole tokenized words, not substrings)
const BANNED_WORDS = [
  // Hebrew
  "שרמוטה",
  "זונה",
  "מניאק",
  "קוקסינל",
  "נאצי",
  "כוסאמאק",
  "זין",
  "שרמוט",
  // English
  "fuck",
  "bitch",
  "asshole",
  "nigger",
  "nigga",
  "whore",
  "slut",
].map((w) => w.toLowerCase());

// Multi-word phrases checked separately (can't be tokenized as a single word)
const BANNED_PHRASES = ["בן זונה"];

const INVITE_REGEX = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)/i;

/* ============================================================
   SECTION: Helpers
   ============================================================ */

/**
 * Tokenizes a message into lowercase words (Hebrew + English letters/digits only)
 * so we can match whole words instead of substrings inside innocent words.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^\u05D0-\u05EA\u0041-\u005A\u0061-\u007A0-9]+/)
    .filter(Boolean);
}

function containsBannedContent(rawText) {
  const text = rawText || "";
  const lower = text.toLowerCase();

  // Phrase check (substring, since it's a specific multi-word phrase)
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return true;
  }

  // Whole-word check
  const words = tokenize(text);
  return words.some((w) => BANNED_WORDS.includes(w));
}

function safeDelete(message) {
  if (!message || !message.deletable) return Promise.resolve();
  return message.delete().catch((err) => {
    console.error(`⚠️ Could not delete message ${message.id}:`, err.message);
  });
}

function sendTemp(channel, content, ms = 6000) {
  if (!channel) return;
  channel
    .send(content)
    .then((sent) => {
      setTimeout(() => safeDelete(sent), ms);
    })
    .catch((err) => {
      console.error(`⚠️ Could not send temp message in #${channel.name || channel.id}:`, err.message);
    });
}

function hasClearPermission(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;
  if (config.allowedClearRoleId && member.roles.cache.has(config.allowedClearRoleId)) return true;
  return false;
}

/**
 * Updates the member-count channel name to reflect the current guild member count.
 * Never throws — logs and continues on any failure (missing channel/permission/rate limit).
 */
async function updateMemberCount(guild) {
  try {
    if (!config.memberCountChannelId) return;
    const channel = guild.channels.cache.get(config.memberCountChannelId);
    if (!channel) {
      console.error("⚠️ Member count channel not found. Check memberCountChannelId in config.json.");
      return;
    }
    const count = guild.memberCount;
    const newName = `👥 חברים בשרת: ${count}`;
    if (channel.name === newName) return; // avoid pointless renames (rate-limit friendly)
    await channel.setName(newName);
  } catch (err) {
    console.error("⚠️ Failed to update member count channel:", err.message);
  }
}

/* ============================================================
   SECTION: Welcome Embed Builder
   ============================================================ */

function buildWelcomeEmbed(member) {
  const embed = new EmbedBuilder()
    .setColor(config.embedColor || "#5865F2")
    .setTitle("🇮🇱 ברוכים הבאים ל-SFS 🇮🇱")
    .setDescription(
      `היי ${member}, כיף שהצטרפת אלינו ל-**Snapzy Frozi SL**! 💜\n` +
        `כאן זה בית — קהילה ישראלית אמיתית של גיימינג, פינות חמד ובלגן טוב.\n\n` +
        `📜 תעיף מבט על החוקים: <#${config.rulesChannelId}>\n` +
        `💬 תגיד שלום בצ'אט הראשי: <#${config.generalChannelId}>\n\n` +
        `תרגיש בבית, תכיר אנשים, ותיהנה 🔥`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: "SFS — Snapzy Frozi SL" })
    .setTimestamp();

  if (BANNER_URL) {
    embed.setImage(BANNER_URL);
  }

  return embed;
}

/* ============================================================
   SECTION: guildMemberAdd — Welcome System
   ============================================================ */

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const embed = buildWelcomeEmbed(member);

    // Send embed to welcome channel
    const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (welcomeChannel) {
      try {
        await welcomeChannel.send({ embeds: [embed] });
      } catch (err) {
        console.error("⚠️ Failed to send welcome embed to channel:", err.message);
      }

      // Short text message, deleted after a few seconds
      sendTemp(welcomeChannel, `${member} ברוך הבא יעמה! מקווים שתהנה 💜`, 8000);
    } else {
      console.error("⚠️ Welcome channel not found. Check welcomeChannelId in config.json.");
    }

    // Try DM — never let a blocked DM crash the bot
    try {
      await member.send({ embeds: [embed] });
    } catch (err) {
      console.log(`ℹ️ Could not DM ${member.user.tag} (DMs likely closed).`);
    }

    // Update member counter
    await updateMemberCount(member.guild);
  } catch (err) {
    console.error("⚠️ Error in guildMemberAdd handler:", err.message);
  }
});

/* ============================================================
   SECTION: guildMemberRemove — Member Counter Update
   ============================================================ */

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await updateMemberCount(member.guild);
  } catch (err) {
    console.error("⚠️ Error in guildMemberRemove handler:", err.message);
  }
});

/* ============================================================
   SECTION: Clear ("ניקוי") Session State
   ============================================================ */

// key: `${channelId}-${userId}` -> { timeout }
const pendingClearSessions = new Map();

function clearSessionKey(channelId, userId) {
  return `${channelId}-${userId}`;
}

function startClearSession(channelId, userId) {
  const key = clearSessionKey(channelId, userId);
  // Clear any existing session/timeout for this user+channel first
  const existing = pendingClearSessions.get(key);
  if (existing) clearTimeout(existing.timeout);

  const timeout = setTimeout(() => {
    pendingClearSessions.delete(key);
  }, 60 * 1000); // expires after 1 minute

  pendingClearSessions.set(key, { timeout });
}

function endClearSession(channelId, userId) {
  const key = clearSessionKey(channelId, userId);
  const existing = pendingClearSessions.get(key);
  if (existing) clearTimeout(existing.timeout);
  pendingClearSessions.delete(key);
}

function hasActiveClearSession(channelId, userId) {
  return pendingClearSessions.has(clearSessionKey(channelId, userId));
}

/* ============================================================
   SECTION: Utility Command Embeds
   ============================================================ */

function buildPingEmbed(ws) {
  return new EmbedBuilder()
    .setColor(config.embedColor || "#5865F2")
    .setDescription(`🏓 Pong! \`${ws}ms\``);
}

function buildServerEmbed(guild) {
  return new EmbedBuilder()
    .setColor(config.embedColor || "#5865F2")
    .setTitle(`🏠 ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: "👥 חברים", value: `${guild.memberCount}`, inline: true },
      { name: "💬 ערוצים", value: `${guild.channels.cache.size}`, inline: true },
      { name: "🆔 Server ID", value: `${guild.id}`, inline: false }
    )
    .setTimestamp();
}

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setColor(config.embedColor || "#5865F2")
    .setTitle("📖 SFS Bot — עזרה")
    .setDescription(
      "🧹 **ניקוי** — ניקוי הודעות (למנהלים בלבד)\n" +
        "🏓 **!ping** — בדיקת פינג\n" +
        "🏠 **!server** — מידע על השרת\n" +
        "📖 **!help** — הצגת עזרה\n\n" +
        "🛡️ Auto-Mod פעיל\n" +
        "🚫 Anti-Invite פעיל\n" +
        "🎈 Welcome פעיל\n" +
        "👥 Member Counter פעיל"
    )
    .setFooter({ text: "SFS — Snapzy Frozi SL" });
}

/* ============================================================
   SECTION: messageCreate — Central Message Handler
   ============================================================ */

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return; // ignore DMs for mod/command features

    const content = message.content.trim();
    const channelId = message.channel.id;
    const userId = message.author.id;

    /* ---------- 1) Active clear session: treat this message as the answer ---------- */
    if (hasActiveClearSession(channelId, userId)) {
      const amount = Number(content);
      endClearSession(channelId, userId);

      if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
        sendTemp(message.channel, "❌ התהליך בוטל.\nבחר מספר בין 1 ל-100.", 6000);
        await safeDelete(message);
        return;
      }

      try {
        const deleted = await message.channel.bulkDelete(amount, true);
        await safeDelete(message);
        sendTemp(message.channel, `🧹 נמחקו ${deleted.size} הודעות בהצלחה.`, 6000);
      } catch (err) {
        console.error("⚠️ Bulk delete failed:", err.message);
        sendTemp(
          message.channel,
          "❌ לא הצלחתי למחוק הודעות (ייתכן שחלקן ישנות מ-14 יום).",
          6000
        );
      }
      return;
    }

    /* ---------- 2) "ניקוי" — start clear flow ---------- */
    if (content === "ניקוי") {
      if (!hasClearPermission(message.member)) {
        sendTemp(message.channel, "❌ אין לך הרשאה להשתמש בפקודה הזו.", 5000);
        return;
      }

      startClearSession(channelId, userId);
      sendTemp(message.channel, "כמה? 🤔\nיש לך דקה לענות.\nכתוב מספר בין 1 ל-100.", 15000);
      return;
    }

    /* ---------- 3) !ping ---------- */
    if (content === "!ping") {
      await message.channel.send({ embeds: [buildPingEmbed(client.ws.ping)] });
      return;
    }

    /* ---------- 4) !server ---------- */
    if (content === "!server") {
      await message.channel.send({ embeds: [buildServerEmbed(message.guild)] });
      return;
    }

    /* ---------- 5) !help ---------- */
    if (content === "!help") {
      await message.channel.send({ embeds: [buildHelpEmbed()] });
      return;
    }

    /* ---------- 6) Anti-Invite ---------- */
    if (INVITE_REGEX.test(content) && !hasClearPermission(message.member)) {
      await safeDelete(message);
      sendTemp(message.channel, `${message.author} 🚫 אסור לפרסם הזמנות לשרתים אחרים כאן.`, 6000);
      return;
    }

    /* ---------- 7) Auto-Mod (profanity) ---------- */
    if (containsBannedContent(content)) {
      await safeDelete(message);
      sendTemp(message.channel, `${message.author} ⚠️ שים לב לשפה שלך בבקשה.`, 6000);
      return;
    }
  } catch (err) {
    console.error("⚠️ Error in messageCreate handler:", err.message);
  }
});

/* ============================================================
   SECTION: Ready
   ============================================================ */

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);

  for (const guild of c.guilds.cache.values()) {
    try {
      await guild.members.fetch(); // ensure accurate memberCount
    } catch (err) {
      console.error(`⚠️ Could not fetch members for ${guild.name}:`, err.message);
    }
    await updateMemberCount(guild);
  }
});

/* ============================================================
   SECTION: Global error safety nets
   ============================================================ */

client.on("error", (err) => console.error("⚠️ Discord client error:", err.message));
process.on("unhandledRejection", (err) => console.error("⚠️ Unhandled rejection:", err));
process.on("uncaughtException", (err) => console.error("⚠️ Uncaught exception:", err));

/* ============================================================
   SECTION: Render Web Service — HTTP keepalive server
   Render's web service type requires an open port to avoid
   "Port scan timeout reached, no open ports detected."
   ============================================================ */

const PORT = Number(process.env.PORT) || 10000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("SFS Bot is running!");
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 HTTP keepalive server listening on 0.0.0.0:${PORT}`);
  });

/* ============================================================
   SECTION: Login
   ============================================================ */

client.login(TOKEN);
