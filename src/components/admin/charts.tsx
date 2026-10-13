"use client";

import dynamic from "next/dynamic";
import type { DonutChartProps, TimeChartProps } from "@/components/admin/highcharts-charts";

// Charts for server pages. Highcharts only runs in the browser, so it is
// loaded there, with a placeholder of the same height while it arrives.

const LazyTimeChart = dynamic(() => import("@/components/admin/highcharts-charts").then((m) => m.TimeChart), {
  ssr: false,
  loading: () => <div className="h-full min-h-[inherit] animate-pulse rounded-xl bg-slate-100" aria-hidden />,
});
const LazyDonutChart = dynamic(() => import("@/components/admin/highcharts-charts").then((m) => m.DonutChart), {
  ssr: false,
  loading: () => <div className="h-full min-h-[inherit] animate-pulse rounded-xl bg-slate-100" aria-hidden />,
});

export function TimeChart(props: TimeChartProps) {
  const height = props.height ?? 280;
  return (
    <div style={{ minHeight: height }}>
      <LazyTimeChart {...props} height={height} />
    </div>
  );
}

export function DonutChart(props: DonutChartProps) {
  const height = props.height ?? 220;
  return (
    <div style={{ minHeight: height }}>
      <LazyDonutChart {...props} height={height} />
    </div>
  );
}
