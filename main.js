import os
import re
import json
import asyncio
import threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

import discord
from discord.ext import commands
from dotenv import load_dotenv


# ============================================================
# SFS BOT
# All-in-one Discord bot
# ============================================================

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"


# ============================================================
# CONFIG
# ============================================================

DEFAULT_CONFIG = {
    "welcomeChannelId": "",
    "memberCountChannelId": "",
    "allowedClearRoleId": "",

    "rulesChannelId": "1552769582278648009",
    "rolesChannelId": "1552769584795226273",
    "generalChannelId": "1552769592378658939",

    "bannerUrl": ""
}


def load_config():
    if not CONFIG_FILE.exists():
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(
                DEFAULT_CONFIG,
                f,
                indent=4,
                ensure_ascii=False
            )

        print("⚠️ נוצר config.json חדש. תמלא את ההגדרות.")
        return DEFAULT_CONFIG.copy()

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)

        for key, value in DEFAULT_CONFIG.items():
            config.setdefault(key, value)

        return config

    except Exception as e:
        print(f"❌ שגיאה בקריאת config.json: {e}")
        return DEFAULT_CONFIG.copy()


config = load_config()


# ============================================================
# TOKEN
# ============================================================

TOKEN = os.getenv("DISCORD_TOKEN")

if not TOKEN:
    TOKEN = config.get("token")

if TOKEN == "PROCESS_ENV_TOKEN":
    TOKEN = os.getenv("DISCORD_TOKEN")

if not TOKEN:
    raise RuntimeError(
        "❌ לא נמצא Discord Token!\n"
        "שים DISCORD_TOKEN ב-.env או ב-Environment Variables."
    )


# ============================================================
# KEEP ALIVE SERVER
# ============================================================

class KeepAliveHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        self.send_response(200)
        self.send_header(
            "Content-Type",
            "text/plain; charset=utf-8"
        )
        self.end_headers()

        self.wfile.write(
            b"SFS Safe Multi-Bot is running!"
        )

    def log_message(self, format, *args):
        return


def start_web_server():

    port = int(
        os.getenv("PORT", "3000")
    )

    server = HTTPServer(
        ("0.0.0.0", port),
        KeepAliveHandler
    )

    print(f"🌐 Web server running on port {port}")

    server.serve_forever()


threading.Thread(
    target=start_web_server,
    daemon=True
).start()


# ============================================================
# DISCORD INTENTS
# ============================================================

intents = discord.Intents.default()

intents.guilds = True
intents.members = True
intents.guild_messages = True
intents.message_content = True


# ============================================================
# BOT
# ============================================================

bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    help_command=None
)


# ============================================================
# BANNED WORDS
# ============================================================

BANNED_WORDS = [
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
]


def escape_regex(text):
    return re.escape(text)


BANNED_REGEX = re.compile(
    r"(^|[^א-תa-zA-Z0-9])("
    + "|".join(
        escape_regex(word)
        for word in BANNED_WORDS
    )
    + r")($|[^א-תa-zA-Z0-9])",
    re.IGNORECASE
)


# ============================================================
# ACTIVE CLEAR SESSIONS
# ============================================================

active_clears = {}

CLEAR_TIMEOUT = 60


def make_session_key(user_id, channel_id):
    return f"{user_id}:{channel_id}"


async def clear_timeout(key):

    try:
        await asyncio.sleep(CLEAR_TIMEOUT)

    except asyncio.CancelledError:
        return

    active_clears.pop(key, None)


def start_clear_session(key):

    old_task = active_clears.get(key)

    if old_task:
        old_task.cancel()

    active_clears[key] = asyncio.create_task(
        clear_timeout(key)
    )


def end_clear_session(key):

    task = active_clears.get(key)

    if task:
        task.cancel()

    active_clears.pop(key, None)


# ============================================================
# PERMISSIONS
# ============================================================

def has_clear_permission(member):

    if not isinstance(member, discord.Member):
        return False

    # מנהל/Manage Messages
    if member.guild_permissions.manage_messages:
        return True

    role_id = config.get(
        "allowedClearRoleId"
    )

    if not role_id:
        return False

    try:
        role_id = int(role_id)
    except (ValueError, TypeError):
        return False

    return any(
        role.id == role_id
        for role in member.roles
    )


# ============================================================
# MEMBER COUNT
# ============================================================

async def update_member_count(guild):

    channel_id = config.get(
        "memberCountChannelId"
    )

    if not channel_id:
        return

    try:

        channel = guild.get_channel(
            int(channel_id)
        )

        if channel is None:
            return

        await channel.edit(
            name=f"👥 חברים בשרת: {guild.member_count}"
        )

    except Exception as e:

        print(
            f"❌ Member counter error: {e}"
        )


# ============================================================
# READY
# ============================================================

@bot.event
async def on_ready():

    print()
    print("=" * 55)
    print("🔥 SFS BOT ONLINE")
    print("=" * 55)
    print(f"🤖 Bot: {bot.user}")
    print(f"🆔 ID: {bot.user.id}")
    print(f"🏠 Servers: {len(bot.guilds)}")
    print("🛡️ Auto-Mod: ON")
    print("🧹 Clear System: ON")
    print("🎈 Welcome System: ON")
    print("👥 Member Counter: ON")
    print("=" * 55)
    print()

    for guild in bot.guilds:

        await update_member_count(
            guild
        )


# ============================================================
# MEMBER JOIN
# ============================================================

@bot.event
async def on_member_join(member):

    banner_url = config.get(
        "bannerUrl"
    )

    rules_channel = config.get(
        "rulesChannelId"
    )

    roles_channel = config.get(
        "rolesChannelId"
    )

    general_channel = config.get(
        "generalChannelId"
    )

    description = (
        f"👋 אהלן {member.mention} "
        f"וברוך הבא לשרת הרשמי של **SFS**!\n\n"

        f"תפסו כיסא בפרלמנט, "
        f"תכינו קפה ותתחילו להכיר אנשים.\n"
        f"כאן לא עושים פוזות, כולם מדברים עם כולם.\n\n"

        f"**לפני שאתה קופץ למים, "
        f"תעשה סיבוב קצר:**\n\n"

        f"📜 חוקים — "
        f"<#{rules_channel}>\n"

        f"🎭 תפקידים — "
        f"<#{roles_channel}>\n"

        f"💬 צ'אט — "
        f"<#{general_channel}>\n\n"

        f"יאללה, בלי להתבייש.\n"
        f"תהנו! 💜"
    )

    embed = discord.Embed(
        title="🇮🇱 ברוכים הבאים ל-SFS 🇮🇱",
        description=description,
        color=discord.Color.from_rgb(
            88,
            101,
            242
        )
    )

    embed.set_thumbnail(
        url=member.display_avatar.url
    )

    if banner_url:
        embed.set_image(
            url=banner_url
        )

    embed.timestamp = discord.utils.utcnow()

    # --------------------------------------------------------
    # DM
    # --------------------------------------------------------

    try:

        await member.send(
            embed=embed
        )

    except (
        discord.Forbidden,
        discord.HTTPException
    ):
        pass

    # --------------------------------------------------------
    # CHANNEL
    # --------------------------------------------------------

    welcome_channel_id = config.get(
        "welcomeChannelId"
    )

    if welcome_channel_id:

        try:

            channel = member.guild.get_channel(
                int(welcome_channel_id)
            )

            if channel:

                if banner_url:

                    banner_embed = discord.Embed(
                        color=discord.Color.from_rgb(
                            88,
                            101,
                            242
                        )
                    )

                    banner_embed.set_image(
                        url=banner_url
                    )

                    await channel.send(
                        embed=banner_embed
                    )

                await channel.send(
                    f"{member.mention} "
                    f"ברוך הבא יעמה! "
                    f"מקווים שתהנה 💜"
                )

        except Exception as e:

            print(
                f"❌ Welcome channel error: {e}"
            )

    await update_member_count(
        member.guild
    )


# ============================================================
# MEMBER LEAVE
# ============================================================

@bot.event
async def on_member_remove(member):

    await update_member_count(
        member.guild
    )


# ============================================================
# AUTO MOD
# ============================================================

async def auto_moderation(message):

    member = message.author

    if has_clear_permission(member):
        return False

    content = message.content.lower()

    # --------------------------------------------------------
    # SWEAR FILTER
    # --------------------------------------------------------

    if BANNED_REGEX.search(content):

        try:
            await message.delete()
        except discord.HTTPException:
            pass

        try:

            warning = await message.channel.send(
                f"⚠️ {member.mention}, "
                f"שמור על השפה שלך! "
                f"אסור לקלל בשרת הזה. ❌"
            )

            await asyncio.sleep(4)

            try:
                await warning.delete()
            except discord.HTTPException:
                pass

        except discord.HTTPException:
            pass

        return True

    # --------------------------------------------------------
    # DISCORD INVITE FILTER
    # --------------------------------------------------------

    invite_patterns = [
        r"discord\.gg/",
        r"discord\.com/invite/",
        r"discordapp\.com/invite/"
    ]

    if any(
        re.search(
            pattern,
            content,
            re.IGNORECASE
        )
        for pattern in invite_patterns
    ):

        try:
            await message.delete()
        except discord.HTTPException:
            pass

        try:

            warning = await message.channel.send(
                f"🚫 {member.mention}, "
                f"חל איסור מוחלט לפרסם "
                f"שרתי דיסקורד אחרים! ❌"
            )

            await asyncio.sleep(4)

            try:
                await warning.delete()
            except discord.HTTPException:
                pass

        except discord.HTTPException:
            pass

        return True

    return False


# ============================================================
# CLEAR SYSTEM
# ============================================================

async def handle_clear(message):

    member = message.author

    if not has_clear_permission(member):

        try:

            warning = await message.reply(
                "אין לך את הרול המתאים "
                "כדי לנהל שיחת ניקוי עם הבוט! ❌"
            )

            await asyncio.sleep(3)

            try:
                await warning.delete()
            except discord.HTTPException:
                pass

            try:
                await message.delete()
            except discord.HTTPException:
                pass

        except discord.HTTPException:
            pass

        return

    key = make_session_key(
        member.id,
        message.channel.id
    )

    start_clear_session(key)

    await message.reply(
        "כמה? 🤔\n"
        "יש לך **דקה** לענות.\n"
        "אפשר לנקות בין **1 ל-100 הודעות**."
    )


# ============================================================
# CLEAR NUMBER
# ============================================================

async def handle_clear_number(message):

    key = make_session_key(
        message.author.id,
        message.channel.id
    )

    if key not in active_clears:
        return False

    try:

        amount = int(
            message.content.strip()
        )

    except ValueError:

        # לא מספר — לא מבטל את הסשן
        return False

    end_clear_session(key)

    # --------------------------------------------------------
    # RANGE
    # --------------------------------------------------------

    if amount < 1 or amount > 100:

        try:

            warning = await message.reply(
                "❌ התהליך בוטל.\n"
                "בחר מספר בין **1 ל-100**."
            )

            await asyncio.sleep(4)

            try:
                await warning.delete()
            except discord.HTTPException:
                pass

        except discord.HTTPException:
            pass

        return True

    # --------------------------------------------------------
    # DELETE
    # --------------------------------------------------------

    try:

        # אנחנו כוללים גם את הודעת המספר.
        # לכן מוחקים amount + 1,
        # אבל לעולם לא יותר מ-100.
        limit = min(
            amount + 1,
            100
        )

        deleted = await message.channel.purge(
            limit=limit,
            bulk=True
        )

        # ההודעה הנוכחית היא אחת מהודעות המחיקה
        # ולכן לא מנסים "להוריד 2" באופן עיוור.
        deleted_count = len(deleted)

        result = await message.channel.send(
            f"🧹 ניקיתי בהצלחה "
            f"**{deleted_count}** "
            f"הודעות!"
        )

        await asyncio.sleep(3)

        try:
            await result.delete()
        except discord.HTTPException:
            pass

    except discord.Forbidden:

        await message.channel.send(
            "❌ אין לי הרשאה למחוק הודעות."
        )

    except discord.HTTPException as e:

        print(
            f"❌ Clear error: {e}"
        )

        try:

            await message.channel.send(
                "❌ לא הצלחתי לבצע את הניקוי.\n"
                "ייתכן שחלק מההודעות ישנות מדי "
                "למחיקה קבוצתית."
            )

        except discord.HTTPException:
            pass

    return True


# ============================================================
# MESSAGE CREATE
# ============================================================

@bot.event
async def on_message(message):

    if message.author.bot:
        return

    if not message.guild:
        return

    # --------------------------------------------------------
    # AUTO MOD
    # --------------------------------------------------------

    blocked = await auto_moderation(
        message
    )

    if blocked:
        return

    # --------------------------------------------------------
    # CLEAR NUMBER
    # --------------------------------------------------------

    handled = await handle_clear_number(
        message
    )

    if handled:
        return

    # --------------------------------------------------------
    # "ניקוי"
    # --------------------------------------------------------

    if message.content.strip() == "ניקוי":

        await handle_clear(
            message
        )

        return

    # --------------------------------------------------------
    # COMMANDS
    # --------------------------------------------------------

    await bot.process_commands(
        message
    )


# ============================================================
# BASIC COMMANDS
# ============================================================

@bot.command()
async def ping(ctx):

    latency = round(
        bot.latency * 1000
    )

    await ctx.send(
        f"🏓 Pong!\n"
        f"`{latency}ms`"
    )


@bot.command()
async def server(ctx):

    guild = ctx.guild

    embed = discord.Embed(
        title=f"🇮🇱 {guild.name}",
        color=discord.Color.from_rgb(
            88,
            101,
            242
        )
    )

    embed.add_field(
        name="👥 Members",
        value=str(
            guild.member_count
        )
    )

    embed.add_field(
        name="💬 Channels",
        value=str(
            len(guild.channels)
        )
    )

    embed.add_field(
        name="🆔 Server ID",
        value=str(
            guild.id
        ),
        inline=False
    )

    if guild.icon:
        embed.set_thumbnail(
            url=guild.icon.url
        )

    await ctx.send(
        embed=embed
    )


@bot.command()
async def helpme(ctx):

    embed = discord.Embed(
        title="🤖 SFS Bot",
        description=(
            "**מערכות פעילות:**\n\n"
            "🧹 `ניקוי` — ניקוי הודעות\n"
            "🏓 `!ping` — בדיקת פינג\n"
            "🏠 `!server` — מידע על השרת\n\n"
            "🛡️ Auto-Mod פעיל\n"
            "🚫 Anti-Invite פעיל\n"
            "🎈 Welcome פעיל\n"
            "👥 Member Counter פעיל"
        ),
        color=discord.Color.from_rgb(
            88,
            101,
            242
        )
    )

    await ctx.send(
        embed=embed
    )


# ============================================================
# ERROR HANDLING
# ============================================================

@bot.event
async def on_command_error(
    ctx,
    error
):

    if isinstance(
        error,
        commands.CommandNotFound
    ):
        return

    print(
        f"❌ Command error: {error}"
    )


# ============================================================
# START
# ============================================================

async def main():

    async with bot:

        await bot.start(
            TOKEN
        )


if __name__ == "__main__":

    try:

        asyncio.run(
            main()
        )

    except KeyboardInterrupt:

        print(
            "🛑 SFS Bot stopped."
        )

    except Exception as e:

        print(
            f"🔥 Fatal error: {e}"
        )
