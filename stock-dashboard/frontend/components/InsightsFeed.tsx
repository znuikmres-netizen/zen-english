"use client";

import type { TelegramMessage } from "@/lib/types";
import { MessageSquare } from "lucide-react";

const SENTIMENT_STYLE = {
  bullish: { label: "看多", cls: "bg-up/20 text-up border-up/30" },
  bearish: { label: "看空", cls: "bg-down/20 text-down border-down/30" },
  neutral: { label: "中立", cls: "bg-slate-700/50 text-slate-400 border-slate-700" },
};

function formatTs(unix: number) {
  const d = new Date(unix * 1000);
  return d.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  messages: TelegramMessage[];
}

export default function InsightsFeed({ messages }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-blue-400" />
        <h2 className="font-semibold text-sm text-slate-300 uppercase tracking-wide">
          AI 精華摘要
        </h2>
        <span className="ml-auto text-xs text-slate-600">最新在上</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-[520px] pr-1">
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">
            尚無訊息，等待 Bot 傳訊…
          </p>
        ) : (
          messages.map((msg) => (
            <article
              key={msg.id}
              className="rounded-lg border border-slate-800 bg-slate-800/40 p-4 space-y-3"
            >
              {/* Stock tags */}
              {msg.stocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.stocks.map((s) => {
                    const style = SENTIMENT_STYLE[s.sentiment] ?? SENTIMENT_STYLE.neutral;
                    return (
                      <span
                        key={s.code}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${style.cls}`}
                      >
                        {s.name}
                        <span className="opacity-60">{s.code}</span>
                        <span className="opacity-75">· {style.label}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Message body */}
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                {msg.text}
              </p>

              {/* Timestamp */}
              <time className="block text-xs text-slate-600">
                {formatTs(msg.timestamp)}
              </time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
