"use client";

import type { LimitData, LimitStock } from "@/lib/types";
import { Flame, TrendingDown } from "lucide-react";

interface Props {
  data?: LimitData;
}

function StockRow({ stock, variant }: { stock: LimitStock; variant: "up" | "down" }) {
  const isUp = variant === "up";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
            isUp ? "bg-up text-white" : "bg-down text-white"
          }`}
        >
          {isUp ? "漲停" : "跌停"}
        </span>
        <span className="text-sm font-medium truncate">{stock.name}</span>
        <span className="text-xs text-slate-500">{stock.code}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <span className="font-mono text-sm">{stock.price.toFixed(2)}</span>
        <span
          className={`text-xs font-semibold w-14 text-right ${
            isUp ? "text-up" : "text-down"
          }`}
        >
          {isUp ? "+" : ""}
          {stock.change_pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function LimitBoard({ data }: Props) {
  const limitUp = data?.limit_up ?? [];
  const limitDown = data?.limit_down ?? [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col">
      <h2 className="font-semibold text-sm text-slate-300 uppercase tracking-wide mb-4">
        當日漲跌停看板
      </h2>

      {/* Limit Up */}
      <div className="flex items-center gap-2 mb-2">
        <Flame size={14} className="text-up" />
        <span className="text-up text-sm font-semibold">
          漲停 ({limitUp.length})
        </span>
      </div>
      <div className="mb-5 max-h-52 overflow-y-auto pr-1">
        {limitUp.length > 0 ? (
          limitUp.map((s) => <StockRow key={s.code} stock={s} variant="up" />)
        ) : (
          <p className="text-slate-600 text-xs py-2">
            {data ? "今日無漲停股" : "載入中…"}
          </p>
        )}
      </div>

      {/* Limit Down */}
      <div className="flex items-center gap-2 mb-2">
        <TrendingDown size={14} className="text-down" />
        <span className="text-down text-sm font-semibold">
          跌停 ({limitDown.length})
        </span>
      </div>
      <div className="max-h-52 overflow-y-auto pr-1">
        {limitDown.length > 0 ? (
          limitDown.map((s) => <StockRow key={s.code} stock={s} variant="down" />)
        ) : (
          <p className="text-slate-600 text-xs py-2">
            {data ? "今日無跌停股" : "載入中…"}
          </p>
        )}
      </div>
    </section>
  );
}
