"use client";

import { useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { fetchKLine } from "@/lib/api";
import type { Stock } from "@/lib/types";
import { LineChart } from "lucide-react";
import clsx from "clsx";

const KLineChart = dynamic(() => import("./KLineChart"), { ssr: false });

const PERIODS = [
  { key: "day",   label: "日K" },
  { key: "week",  label: "週K" },
  { key: "month", label: "月K" },
];

interface Props {
  stocks: Stock[];
}

export default function StockWatchlist({ stocks }: Props) {
  const [activeStock, setActiveStock] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState("day");

  const selectedCode = activeStock ?? stocks[0]?.code ?? null;
  const selectedName = stocks.find((s) => s.code === selectedCode)?.name ?? selectedCode;

  const { data: klineData, isLoading } = useSWR(
    selectedCode ? `kline-${selectedCode}-${activePeriod}` : null,
    () => fetchKLine(selectedCode!, activePeriod),
    { revalidateOnFocus: false }
  );

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <LineChart size={16} className="text-blue-400" />
        <h2 className="font-semibold text-sm text-slate-300 uppercase tracking-wide">
          K 線觀測區
        </h2>
      </div>

      {stocks.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">
          尚無 Telegram 訊息記錄，等待 Bot 傳訊中…
        </p>
      ) : (
        <>
          {/* Stock tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {stocks.map((s) => (
              <button
                key={s.code}
                onClick={() => setActiveStock(s.code)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  (activeStock ?? stocks[0].code) === s.code
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                {s.name}
                <span className="ml-1 text-xs opacity-60">{s.code}</span>
              </button>
            ))}
          </div>

          {/* Period switcher */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-semibold">
              {selectedName}
              <span className="text-slate-500 text-sm ml-2">{selectedCode}</span>
            </p>
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActivePeriod(p.key)}
                  className={clsx(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    activePeriod === p.key
                      ? "bg-slate-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {isLoading ? (
            <div className="h-[380px] flex items-center justify-center text-slate-500 text-sm animate-pulse">
              載入 K 線資料…
            </div>
          ) : (
            <KLineChart data={klineData ?? []} />
          )}
        </>
      )}
    </section>
  );
}
