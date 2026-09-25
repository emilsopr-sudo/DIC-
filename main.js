import os
import re
import asyncio
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import discord
from discord.ext import commands
from dotenv import load_dotenv


# ============================================================
# SFS BOT - ALL IN ONE
# ============================================================

load_dotenv()


# ============================================================
# 🔧 הגדרות שרת
# ============================================================

WELCOME_CHANNEL_ID = 1552769580856909938
MEMBER_COUNT_CHANNEL_ID = 1552806717308543046
RULES_CHANNEL_ID = 1552769582278648009
GENERAL_CHANNEL_ID = 1552769587408543927

# 👑 מי שמחזיק ברול הזה יכול להשתמש ב"ניקוי"
ALLOWED_CLEAR_ROLE_ID = 1552769521885118494


# ============================================================
# 🔐 Token
# ============================================================
# שים את הטוקן שלך ב-Render Environment Variables:
# DISCORD_TOKEN=YOUR_TOKEN
#
# אל תשים את הטוקן בתוך הקוד ואל תעלה אותו ל-GitHub.

TOKEN = os.getenv("DISCORD_TOKEN")

if not TOKEN:
    raise RuntimeError(
        "❌ לא נמצא DISCORD_TOKEN!\n"
        "שים את הטוקן שלך ב-Render תחת Environment Variables."
    )


# ============================================================
# 🖼️ BANNER
# ============================================================
# שים ב-Render Environment Variables:
# BANNER_URL=https://....
#
# או החלף ישירות כאן בקישור שלך.

BANNER_URL = os.getenv(
    "BANNER_URL",
    ""
)


# ============================================================
# 🌐 WEB SERVER - Render
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

    print(
        f"🌐 Web server running on port {port}"
    )

    server.serve_forever()


threading.Thread(
    target=start_web_server,
    daemon=True
).start()


# ============================================================
# 🤖 DISCORD INTENTS
# ============================================================

intents = discord.Intents.default()

intents.guilds = True
intents.members = True
intents.guild_messages = True
intents.message_content = True


# ============================================================
# 🤖 BOT
# ============================================================

bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    help_command=None
)


# ============================================================
# 🤬 מילים אסורות
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


def escape_regex(text: str) -> str:
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
# 🧹 SESSIONS של ניקוי
# ============================================================

active_clears = {}

CLEAR_TIMEOUT = 60


def make_session_key(user_id: int, channel_id: int) -> str:
    return f"{user_id}:{channel_id}"


async def clear_session_timeout(key: str):

    try:
        await asyncio.sleep(CLEAR_TIMEOUT)

    except asyncio.CancelledError:
        return

    active_clears.pop(key, None)


def start_clear_session(key: str):

    old_task = active_clears.get(key)

    if old_task:
        old_task.cancel()

    active_clears[key] = asyncio.create_task(
        clear_session_timeout(key)
    )


def end_clear_session(key: str):

    task = active_clears.get(key)

    if task:
        task.cancel()

    active_clears.pop(key, None)


# ============================================================
# 🎖️ בדיקת הרשאת ניקוי
# ============================================================

def has_clear_permission(member: discord.Member) -> bool:

    if not isinstance(member, discord.Member):
        return False

    # מנהלים עם Manage Messages יכולים גם
    if member.guild_permissions.manage_messages:
        return True

    return any(
        role.id == ALLOWED_CLEAR_ROLE_ID
        for role in member.roles
    )


# ============================================================
# 👥 עדכון מונה חברים
# ============================================================

async def update_member_count(guild: discord.Guild):

    try:

        channel = guild.get_channel(
            MEMBER_COUNT_CHANNEL_ID
        )

        if not channel:
            print(
                "⚠️ ערוץ מונה החברים לא נמצא."
            )
            return

        await channel.edit(
            name=f"👥 חברים בשרת: {guild.member_count}"
        )

        print(
            f"👥 מונה עודכן: {guild.member_count}"
        )

    except discord.Forbidden:

        print(
            "❌ אין לבוט הרשאה לשנות את שם ערוץ המונה."
        )

    except discord.HTTPException as error:

        print(
            f"❌ שגיאה בעדכון מונה: {error}"
        )


# ============================================================
# ✅ READY
# ============================================================

@bot.event
async def on_ready():

    print()
    print("=" * 60)
    print("🔥 SFS BOT ONLINE")
    print("=" * 60)
    print(f"🤖 Bot: {bot.user}")
    print(f"🆔 Bot ID: {bot.user.id}")
    print(f"🏠 Servers: {len(bot.guilds)}")
    print("🛡️ Auto-Mod: ON")
    print("🚫 Anti-Invite: ON")
    print("🧹 Clear: ON")
    print("🎈 Welcome: ON")
    print("👥 Member Counter: ON")
    print("=" * 60)
    print()

    for guild in bot.guilds:
        await update_member_count(guild)


# ============================================================
# 🎈 MEMBER JOIN
# ============================================================

@bot.event
async def on_member_join(member: discord.Member):

    welcome_embed = discord.Embed(
        title="🇮🇱 ברוכים הבאים ל-SFS 🇮🇱",
        description=(
            f"👋 אהלן {member.mention} וברוך הבא "
            f"לשרת הרשמי של **SFS**!\n\n"

            f"תפסו כיסא בפרלמנט, תכינו קפה "
            f"ותתחילו להכיר אנשים.\n"
            f"כאן לא עושים פוזות, כולם מדברים עם כולם.\n\n"

            f"**לפני שאתה קופץ למים, "
            f"תעשה סיבוב קצר:**\n\n"

            f"📜 ספר החוקים — "
            f"<#{RULES_CHANNEL_ID}>\n"

            f"💬 צ'אט ראשי — "
            f"<#{GENERAL_CHANNEL_ID}>\n\n"

            f"יאללה, בלי להתבייש.\n"
            f"תהנו! 💜"
        ),
        color=discord.Color.from_rgb(
            88,
            101,
            242
        )
    )

    welcome_embed.set_thumbnail(
        url=member.display_avatar.url
    )

    if BANNER_URL:
        welcome_embed.set_image(
            url=BANNER_URL
        )

    welcome_embed.timestamp = discord.utils.utcnow()

    # --------------------------------------------------------
    # 📩 DM
    # --------------------------------------------------------

    try:

        await member.send(
            embed=welcome_embed
        )

    except (
        discord.Forbidden,
        discord.HTTPException
    ):

        pass

    # --------------------------------------------------------
    # 📢 Welcome Channel
    # --------------------------------------------------------

    try:

        channel = member.guild.get_channel(
            WELCOME_CHANNEL_ID
        )

        if channel:

            if BANNER_URL:

                banner_embed = discord.Embed(
                    color=discord.Color.from_rgb(
                        88,
                        101,
                        242
                    )
                )

                banner_embed.set_image(
                    url=BANNER_URL
                )

                await channel.send(
                    embed=banner_embed
                )

            await channel.send(
                f"{member.mention} "
                f"ברוך הבא יעמה! "
                f"מקווים שתהנה 💜"
            )

    except (
        discord.Forbidden,
        discord.HTTPException
    ):

        pass

    # --------------------------------------------------------
    # 👥 Counter
    # --------------------------------------------------------

    await update_member_count(
        member.guild
    )


# ============================================================
# 🚪 MEMBER LEAVE
# ============================================================

@bot.event
async def on_member_remove(member: discord.Member):

    await update_member_count(
        member.guild
    )


# ============================================================
# 🛡️ AUTO MOD
# ============================================================

async def run_auto_moderation(message: discord.Message):

    member = message.author

    # רול מנהלים / Manage Messages פטור מהפילטר
    if has_clear_permission(member):
        return False

    content = message.content.lower()

    # --------------------------------------------------------
    # 🤬 קללות
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
    # 🚫 INVITES
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
# 🧹 ניקוי
# ============================================================

async def start_clear(message: discord.Message):

    if not has_clear_permission(
        message.author
    ):

        try:

            warning = await message.reply(
                "אין לך הרשאה להשתמש במערכת הניקוי! ❌"
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
        message.author.id,
        message.channel.id
    )

    start_clear_session(key)

    await message.reply(
        "כמה? 🤔\n"
        "יש לך **דקה** לענות.\n"
        "כתוב מספר בין **1 ל-100**."
    )


# ============================================================
# 🔢 מספר ניקוי
# ============================================================

async def process_clear_number(message: discord.Message):

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

        # אם זה לא מספר, מחכים להודעה הבאה
        return False

    end_clear_session(key)

    # --------------------------------------------------------
    # בדיקת טווח
    # --------------------------------------------------------

    if amount < 1 or amount > 100:

        try:

            warning = await message.reply(
                "❌ התהליך בוטל.\n"
                "צריך לבחור מספר בין **1 ל-100**."
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
    # ניקוי
    # --------------------------------------------------------

    try:

        deleted = await message.channel.purge(
            limit=amount + 1,
            bulk=True
        )

        deleted_count = len(deleted)

        success = await message.channel.send(
            f"🧹 ניקיתי בהצלחה "
            f"**{deleted_count}** "
            f"הודעות!"
        )

        await asyncio.sleep(3)

        try:
            await success.delete()
        except discord.HTTPException:
            pass

    except discord.Forbidden:

        await message.channel.send(
            "❌ אין לי הרשאה למחוק הודעות."
        )

    except discord.HTTPException as error:

        print(
            f"❌ Clear error: {error}"
        )

        try:

            await message.channel.send(
                "❌ לא הצלחתי לבצע את הניקוי.\n"
                "יכול להיות שיש הודעות ישנות מדי."
            )

        except discord.HTTPException:
            pass

    return True


# ============================================================
# 💬 MESSAGE CREATE
# ============================================================

@bot.event
async def on_message(message: discord.Message):

    if message.author.bot:
        return

    if not message.guild:
        return

    # --------------------------------------------------------
    # 🛡️ Auto Mod
    # --------------------------------------------------------

    blocked = await run_auto_moderation(
        message
    )

    if blocked:
        return

    # --------------------------------------------------------
    # 🧹 בדיקת ניקוי פעיל
    # --------------------------------------------------------

    clear_handled = await process_clear_number(
        message
    )

    if clear_handled:
        return

    # --------------------------------------------------------
    # 🧹 "ניקוי"
    # --------------------------------------------------------

    if message.content.strip() == "ניקוי":

        await start_clear(
            message
        )

        return

    # --------------------------------------------------------
    # פקודות
    # --------------------------------------------------------

    await bot.process_commands(
        message
    )


# ============================================================
# 🏓 PING
# ============================================================

@bot.command()
async def ping(ctx):

    latency = round(
        bot.latency * 1000
    )

    await ctx.send(
        f"🏓 **Pong!** `{latency}ms`"
    )


# ============================================================
# 🏠 SERVER INFO
# ============================================================

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
        name="👥 חברים",
        value=str(
            guild.member_count
        )
    )

    embed.add_field(
        name="💬 ערוצים",
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


# ============================================================
# 📖 HELP
# ============================================================

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
# ❌ COMMAND ERRORS
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
# 🚀 START
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

    except Exception as error:

        print(
            f"🔥 Fatal error: {error}"
        )
        )
