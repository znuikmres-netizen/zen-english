"""Run once after Railway deployment to register the Telegram webhook.

Usage:
    TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL=https://your-app.railway.app python setup_webhook.py
"""
import os
import sys
import requests

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
SECRET = os.getenv("WEBHOOK_SECRET", "")

if not BOT_TOKEN or not WEBHOOK_URL:
    print("Set TELEGRAM_BOT_TOKEN and WEBHOOK_URL env vars first.")
    sys.exit(1)

url = f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook"
payload = {
    "url": f"{WEBHOOK_URL.rstrip('/')}/webhook/telegram",
    "allowed_updates": ["message", "channel_post"],
}
if SECRET:
    payload["secret_token"] = SECRET

resp = requests.post(url, json=payload)
print(resp.json())
