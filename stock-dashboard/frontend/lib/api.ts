import type { MarketData, Stock, KLineBar, TelegramMessage, LimitData } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const fetchMarket  = () => get<MarketData>("/api/market");
export const fetchStocks  = () => get<Stock[]>("/api/stocks");
export const fetchMessages = () => get<TelegramMessage[]>("/api/messages");
export const fetchLimits  = () => get<LimitData>("/api/limits");
export const fetchKLine   = (code: string, period: string) =>
  get<KLineBar[]>(`/api/kline/${code}?period=${period}`);
