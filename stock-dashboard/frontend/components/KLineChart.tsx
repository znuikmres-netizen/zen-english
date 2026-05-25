"use client";

import { useEffect, useRef } from "react";
import type { KLineBar } from "@/lib/types";

interface Props {
  data: KLineBar[];
}

export default function KLineChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Hold references so cleanup can remove them
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let cancelled = false;

    (async () => {
      const {
        createChart,
        ColorType,
        CrosshairMode,
      } = await import("lightweight-charts");

      if (cancelled || !containerRef.current) return;

      // Remove previous chart instance
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove();
        chartRef.current = null;
      }

      const container = containerRef.current;
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 380,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#94a3b8",
        },
        grid: {
          vertLines: { color: "#1e293b" },
          horzLines: { color: "#1e293b" },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#334155" },
        timeScale: {
          borderColor: "#334155",
          timeVisible: false,
        },
      });

      chartRef.current = chart;

      // Taiwan: up = red, down = green
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#ef4444",
        downColor: "#22c55e",
        borderUpColor: "#ef4444",
        borderDownColor: "#22c55e",
        wickUpColor: "#ef4444",
        wickDownColor: "#22c55e",
      });

      candleSeries.setData(
        data.map((d) => ({
          time: d.time as `${number}-${number}-${number}`,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
      );

      const volumeSeries = chart.addHistogramSeries({
        color: "#64748b",
        priceFormat: { type: "volume" },
        priceScaleId: "",
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      volumeSeries.setData(
        data.map((d) => ({
          time: d.time as `${number}-${number}-${number}`,
          value: d.volume,
          color: d.close >= d.open ? "#ef444440" : "#22c55e40",
        }))
      );

      chart.timeScale().fitContent();

      const handleResize = () => {
        if (container && chartRef.current) {
          (chartRef.current as { applyOptions: (o: object) => void }).applyOptions({
            width: container.clientWidth,
          });
        }
      };
      window.addEventListener("resize", handleResize);

      // Return cleanup (stored on container)
      (container as HTMLDivElement & { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener("resize", handleResize);
      };
    })();

    return () => {
      cancelled = true;
      const container = containerRef.current as (HTMLDivElement & { _cleanup?: () => void }) | null;
      container?._cleanup?.();
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove();
        chartRef.current = null;
      }
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="h-[380px] flex items-center justify-center text-slate-500 text-sm">
        無 K 線資料
      </div>
    );
  }

  return <div ref={containerRef} className="tv-chart-container h-[380px]" />;
}
