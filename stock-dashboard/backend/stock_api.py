import yfinance as yf
import requests
import logging

logger = logging.getLogger(__name__)

PERIOD_MAP = {
    "day": ("3mo", "1d"),
    "week": ("1y", "1wk"),
    "month": ("3y", "1mo"),
}

TWSE_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockDashboard/1.0)"}


def get_kline_data(code: str, period: str = "day") -> list[dict]:
    yf_period, yf_interval = PERIOD_MAP.get(period, PERIOD_MAP["day"])
    ticker = yf.Ticker(f"{code}.TW")
    hist = ticker.history(period=yf_period, interval=yf_interval)

    if hist.empty:
        return []

    result = []
    for idx, row in hist.iterrows():
        result.append({
            "time": idx.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })
    return result


def get_market_overview() -> dict:
    ticker = yf.Ticker("^TWII")
    intraday = ticker.history(period="1d", interval="5m")

    if intraday.empty:
        return {"error": "no data"}

    info = ticker.fast_info
    prev_close = float(getattr(info, "previous_close", 0) or 0)
    current = float(intraday["Close"].iloc[-1])
    change = round(current - prev_close, 2) if prev_close else 0
    change_pct = round(change / prev_close * 100, 2) if prev_close else 0

    chart = []
    for idx, row in intraday.iterrows():
        chart.append({
            "time": idx.strftime("%H:%M"),
            "price": round(float(row["Close"]), 2),
        })

    return {
        "price": round(current, 2),
        "change": change,
        "change_pct": change_pct,
        "volume": int(intraday["Volume"].sum()),
        "chart": chart,
    }


def get_limit_stocks() -> dict:
    """Fetch all-stock after-trading data from TWSE and detect limit up/down."""
    try:
        url = "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json"
        resp = requests.get(url, headers=TWSE_HEADERS, timeout=15)
        data = resp.json()

        if data.get("stat") != "OK":
            return {"limit_up": [], "limit_down": []}

        records = data.get("data", [])
        limit_up, limit_down = [], []

        for rec in records:
            try:
                code = rec[0].strip()
                name = rec[1].strip()
                close_str = rec[8].replace(",", "").strip()
                sign = rec[9].strip()
                diff_str = rec[10].replace(",", "").strip()

                if not close_str or close_str in ("--", ""):
                    continue

                close = float(close_str)
                diff = float(diff_str) if diff_str not in ("--", "") else 0.0

                if sign == "+" and diff > 0:
                    prev = close - diff
                    pct = diff / prev * 100 if prev > 0 else 0
                    if pct >= 9.5:
                        limit_up.append({"code": code, "name": name, "price": close, "change_pct": round(pct, 2)})
                elif sign == "-" and diff > 0:
                    prev = close + diff
                    pct = diff / prev * 100 if prev > 0 else 0
                    if pct >= 9.5:
                        limit_down.append({"code": code, "name": name, "price": close, "change_pct": round(-pct, 2)})
            except (ValueError, IndexError):
                continue

        limit_up.sort(key=lambda x: x["change_pct"], reverse=True)
        limit_down.sort(key=lambda x: x["change_pct"])
        return {"limit_up": limit_up[:30], "limit_down": limit_down[:30]}

    except Exception as e:
        logger.error(f"get_limit_stocks error: {e}")
        return {"limit_up": [], "limit_down": [], "error": str(e)}
