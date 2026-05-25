"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { MarketData } from "@/lib/types";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface Props {
  data?: MarketData;
}

export default function MarketOverview({ data }: Props) {
  const isUp = (data?.change ?? 0) >= 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
            台灣加權指數 TAIEX
          </p>
          {data && !data.error ? (
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold font-mono tabular-nums">
                {data.price.toLocaleString()}
              </span>
              <span
                className={`flex items-center gap-1 text-base font-semibold ${
                  isUp ? "text-up" : "text-down"
                }`}
              >
                {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {isUp ? "+" : ""}
                {data.change.toFixed(2)} ({data.change_pct.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <p className="text-slate-500 text-sm mt-1">載入中…</p>
          )}
        </div>

        {data && !data.error && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Activity size={14} />
            成交量&nbsp;
            <span className="text-slate-200 font-mono">
              {(data.volume / 1e8).toFixed(1)} 億
            </span>
          </div>
        )}
      </div>

      {/* Area chart */}
      <div className="h-36">
        {data?.chart?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.chart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isUp ? "#ef4444" : "#22c55e"} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isUp ? "#ef4444" : "#22c55e"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#f1f5f9" }}
                formatter={(v: number) => [v.toLocaleString(), "指數"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isUp ? "#ef4444" : "#22c55e"}
                strokeWidth={1.5}
                fill="url(#grad)"
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
            {data?.error ? "無法取得大盤資料" : "資料載入中…"}
          </div>
        )}
      </div>
    </section>
  );
}
