# 股票觀測 Dashboard

Telegram Bot 驅動的台股即時觀測儀表板。

## 架構
```
Telegram Bot → FastAPI (Railway) → SQLite
                    ↓
              yfinance / TWSE API
                    ↓
          Next.js + Tailwind (Vercel)
```

## 部署步驟

### 1. 後端 → Railway

1. 在 Railway 新建 project，選 **Deploy from GitHub repo**
2. 選 `stock-dashboard/backend` 為 root directory（或用 Monorepo 設定）
3. 設定環境變數：
   ```
   TELEGRAM_BOT_TOKEN=   ← BotFather 給的 token
   TELEGRAM_GROUP_ID=    ← 群組 ID（負數，如 -100123456789）
   WEBHOOK_SECRET=       ← 自訂一個亂數字串
   ```
4. Railway 自動偵測 `Procfile` 並啟動

### 2. 註冊 Telegram Webhook

Railway 部署完畢後執行一次：
```bash
cd backend
TELEGRAM_BOT_TOKEN=xxx \
WEBHOOK_URL=https://your-app.up.railway.app \
WEBHOOK_SECRET=your_secret \
python setup_webhook.py
```

### 3. 前端 → Vercel

1. 在 Vercel 新建 project，選 `stock-dashboard/frontend` 為 root directory
2. 設定環境變數：
   ```
   NEXT_PUBLIC_API_URL=https://your-app.up.railway.app
   ```
3. Deploy → 取得可分享的網址

## 本地開發

```bash
# 後端
cd backend
pip install -r requirements.txt
cp .env.example .env   # 填入真實值
uvicorn main:app --reload

# 前端
cd frontend
npm install
cp .env.example .env.local  # 填入 http://localhost:8000
npm run dev
```

## Telegram 訊息格式

Bot 傳送的訊息需包含格式 `股票名稱(代號)`，例如：

```
台積電(2330) 看多
CoWoS 需求強勁，法人買超 3萬張
目標價上調至 1,200

鴻海(2317) 看空
短線壓力位 200，留意量能
```

系統會自動解析：股票代號、名稱、看多/看空情緒。
