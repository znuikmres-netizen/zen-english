export interface KLineBar {
  time: string;   // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPoint {
  time: string;
  price: number;
}

export interface MarketData {
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  chart: ChartPoint[];
  error?: string;
}

export interface Stock {
  code: string;
  name: string;
  mention_count: number;
}

export interface StockRef {
  code: string;
  name: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

export interface TelegramMessage {
  id: number;
  text: string;
  timestamp: number;
  stocks: StockRef[];
}

export interface LimitStock {
  code: string;
  name: string;
  price: number;
  change_pct: number;
}

export interface LimitData {
  limit_up: LimitStock[];
  limit_down: LimitStock[];
  error?: string;
}
