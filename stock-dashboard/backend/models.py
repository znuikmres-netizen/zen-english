from sqlalchemy import Column, Integer, String, Text, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True)
    chat_id = Column(String(50))
    text = Column(Text)
    telegram_ts = Column(BigInteger)  # Unix timestamp from Telegram
    created_at = Column(DateTime, default=datetime.utcnow)

    stock_mentions = relationship("StockMention", back_populates="message", cascade="all, delete-orphan")


class StockMention(Base):
    __tablename__ = "stock_mentions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"))
    code = Column(String(10), index=True)
    name = Column(String(50))
    sentiment = Column(String(20), default="neutral")  # bullish, bearish, neutral

    message = relationship("Message", back_populates="stock_mentions")
