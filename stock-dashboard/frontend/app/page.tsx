"use client";

import useSWR from "swr";
import { fetchMarket, fetchStocks, fetchMessages, fetchLimits } from "@/lib/api";
import MarketOverview from "@/components/MarketOverview";
import StockWatchlist from "@/components/StockWatchlist";
import LimitBoard from "@/components/LimitBoard";
import InsightsFeed from "@/components/InsightsFeed";
import { BarChart2 } from "lucide-react";

export default function Dashboard() {
  const { data: market } = useSWR("market", fetchMarket, { refreshInterval: 60_000 });
  const { data: stocks } = useSWR("stocks", fetchStocks, { refreshInterval: 300_000 });
  const { data: messages } = useSWR("messages", fetchMessages, { refreshInterval: 120_000 });
  const { data: limits } = useSWR("limits", fetchLimits, { refreshInterval: 300_000 });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0f172a]/90 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <BarChart2 className="text-blue-400" size={22} />
        <span className="font-semibold text-lg tracking-tight">股票觀測台</span>
        {market && !market.error && (
          <div className="ml-4 flex items-baseline gap-2">
            <span className="text-slate-400 text-sm">加權指數</span>
            <span className="font-mono text-base font-semibold">
              {market.price.toLocaleString()}
            </span>
            <span
              className={`text-sm font-medium ${
                market.change >= 0 ? "text-up" : "text-down"
              }`}
            >
              {market.change >= 0 ? "▲" : "▼"}
              {Math.abs(market.change_pct).toFixed(2)}%
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-400">Live</span>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Row 1 */}
        <MarketOverview data={market} />

        {/* Row 2 */}
        <StockWatchlist stocks={stocks ?? []} />

        {/* Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LimitBoard data={limits} />
          <InsightsFeed messages={messages ?? []} />
        </div>
      </main>

      <footer className="mt-10 pb-6 text-center text-xs text-slate-600">
        資料來源：TWSE × Yahoo Finance × Telegram Bot &nbsp;|&nbsp; 每日 16:35 自動更新
      </footer>
    </div>
  );
}
