import re

BULLISH_KEYWORDS = ["看多", "看漲", "買進", "做多", "強勢", "突破", "上攻", "利多", "正向", "偏多"]
BEARISH_KEYWORDS = ["看空", "看跌", "賣出", "做空", "弱勢", "跌破", "下殺", "利空", "負向", "偏空"]

# Matches: 台積電(2330) or 台積電 (2330)
STOCK_PATTERN = re.compile(r"([一-鿿㐀-䶿]{1,8})\s*[（(](\d{4,5})[）)]")


def _detect_sentiment(context: str) -> str:
    for kw in BULLISH_KEYWORDS:
        if kw in context:
            return "bullish"
    for kw in BEARISH_KEYWORDS:
        if kw in context:
            return "bearish"
    return "neutral"


def parse_message(text: str) -> dict:
    stocks = []
    seen_codes = set()

    for match in STOCK_PATTERN.finditer(text):
        name = match.group(1).strip()
        code = match.group(2).strip()
        if code in seen_codes:
            continue
        seen_codes.add(code)

        # Check sentiment in surrounding 200 chars
        start = max(0, match.start() - 50)
        end = min(len(text), match.end() + 200)
        sentiment = _detect_sentiment(text[start:end])

        stocks.append({"name": name, "code": code, "sentiment": sentiment})

    return {"stocks": stocks}
