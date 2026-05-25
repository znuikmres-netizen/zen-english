import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal, get_db
from models import Message, StockMention
from message_parser import parse_message
from stock_api import get_kline_data, get_market_overview, get_limit_stocks

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


def daily_update_job():
    logger.info("Running daily stock cache update…")
    db = SessionLocal()
    try:
        stocks = db.query(StockMention.code).distinct().all()
        for (code,) in stocks:
            for period in ("day", "week", "month"):
                try:
                    get_kline_data(code, period)
                except Exception as e:
                    logger.warning(f"  {code}/{period}: {e}")
    finally:
        db.close()
    logger.info("Daily update complete.")


scheduler = BackgroundScheduler(timezone="Asia/Taipei")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(daily_update_job, CronTrigger(hour=16, minute=35), id="daily_update")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Stock Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your Vercel URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Telegram Webhook ──────────────────────────────────────────────────────────

@app.post("/webhook/telegram")
async def telegram_webhook(request: Request):
    # Verify secret token header
    if WEBHOOK_SECRET:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if token != WEBHOOK_SECRET:
            raise HTTPException(status_code=403, detail="Forbidden")

    payload = await request.json()
    msg = payload.get("message") or payload.get("channel_post")
    if not msg:
        return {"ok": True}

    text = msg.get("text") or msg.get("caption") or ""
    if not text:
        return {"ok": True}

    parsed = parse_message(text)

    db = SessionLocal()
    try:
        # Deduplicate by telegram message id
        telegram_id = msg["message_id"]
        if db.query(Message).filter(Message.telegram_id == telegram_id).first():
            return {"ok": True}

        record = Message(
            telegram_id=telegram_id,
            chat_id=str(msg["chat"]["id"]),
            text=text,
            telegram_ts=msg["date"],
        )
        db.add(record)
        db.flush()

        for s in parsed["stocks"]:
            db.add(StockMention(
                message_id=record.id,
                code=s["code"],
                name=s["name"],
                sentiment=s["sentiment"],
            ))

        db.commit()
    finally:
        db.close()

    return {"ok": True}


# ── REST API ──────────────────────────────────────────────────────────────────

@app.get("/api/market")
def api_market():
    try:
        return get_market_overview()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stocks")
def api_stocks(db: Session = Depends(get_db)):
    rows = (
        db.query(StockMention.code, StockMention.name, func.count(StockMention.id).label("cnt"))
        .group_by(StockMention.code, StockMention.name)
        .order_by(desc("cnt"))
        .limit(20)
        .all()
    )
    return [{"code": r.code, "name": r.name, "mention_count": r.cnt} for r in rows]


@app.get("/api/kline/{code}")
def api_kline(code: str, period: str = Query("day", pattern="^(day|week|month)$")):
    try:
        return get_kline_data(code, period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/messages")
def api_messages(limit: int = Query(30, le=100), db: Session = Depends(get_db)):
    msgs = (
        db.query(Message)
        .order_by(Message.telegram_ts.desc())
        .limit(limit)
        .all()
    )
    result = []
    for m in msgs:
        result.append({
            "id": m.id,
            "text": m.text,
            "timestamp": m.telegram_ts,
            "stocks": [
                {"code": s.code, "name": s.name, "sentiment": s.sentiment}
                for s in m.stock_mentions
            ],
        })
    return result


@app.get("/api/limits")
def api_limits():
    try:
        return get_limit_stocks()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
