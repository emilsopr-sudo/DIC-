import discord
from discord.ext import commands
import asyncio

# הגדרת ה-Intents (הרשאות הבוט)
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

# שים כאן את השם המדויק של הרול שמורשה לנקות הודעות
ALLOWED_ROLE_NAME = "שם הרול המורשה" 

@bot.event
async def on_ready():
    print(f'הבוט מחובר כחבר בשם: {bot.user.name}')

@bot.get_command  # הגדרת פקודת הניקוי
@bot.command(name="ניקוי")
async def clear_messages(ctx):
    # 1. בדיקה האם למשתמש יש את הרול המורשה
    user_roles = [role.name for role in ctx.author.roles]
    if ALLOWED_ROLE_NAME not in user_roles:
        await ctx.send("❌ אין לך את ההרשאה (הרול המתאים) לבצע ניקוי הודעות!")
        return

    # 2. הבוט שואל כמה הודעות למחוק
    bot_msg = await ctx.send(f"👋 {ctx.author.mention}, כמה הודעות תרצה למחוק?")

    # פונקציית בדיקה שמוודאת שרק מי שרשם "ניקוי" עונה, ושהתשובה היא מספר
    def check(message):
        return message.author == ctx.author and message.channel == ctx.channel and message.content.isdigit()

    try:
        # 3. הבוט מחכה לתשובה (מחכה עד 30 שניות)
        user_response = await bot.wait_for('message', check=check, timeout=30.0)
        amount = int(user_response.content)

        # 4. מחיקת ההודעות (כולל הודעת המשתמש, הודעת הבוט והתשובה)
        # מוסיפים 2 כדי למחוק גם את השאלה של הבוט ואת התשובה של המשתמש
        deleted = await ctx.channel.purge(limit=amount + 2)
        
        # 5. שליחת הודעת אישור זמנית שנמחקת אחרי 3 שניות
        success_msg = await ctx.send(f"🗑️ נמחקו בהצלחה {len(deleted) - 2} הודעות.")
        await asyncio.sleep(3)
        await success_msg.delete()

    except asyncio.TimeoutError:
        # אם המשתמש לא ענה תוך 30 שניות
        await bot_msg.edit(content="⏰ הזמן עבר, פקודת הניקוי בוטלה.")
        await asyncio.sleep(3)
        await bot_msg.delete()

# תמיד תשמור את הטוקן שלך חסוי!
bot.run('YOUR_BOT_TOKEN_HERE')
