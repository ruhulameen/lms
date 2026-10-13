"use client";

import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";

// Highcharts charts in the admin panel's look. Import them from charts.tsx,
// which loads this file in the browser only (Highcharts needs `window`).
// Highcharts needs a commercial licence for a commercial site:
// https://shop.highcharts.com

const GRID = "#eef2f7";
const TEXT = "#64748b";

const base: Highcharts.Options = {
  title: { text: undefined },
  credits: { enabled: false },
  legend: { enabled: false },
  chart: { backgroundColor: "transparent", style: { fontFamily: "inherit" }, spacing: [8, 4, 4, 4] },
  tooltip: {
    backgroundColor: "#0f2a5c",
    borderWidth: 0,
    borderRadius: 8,
    shadow: false,
    padding: 10,
    style: { color: "#ffffff", fontSize: "12px" },
  },
};

export type TimeChartProps = {
  // One label and one value per day or month, in order.
  points: { label: string; value: number }[];
  // What the values are, e.g. "Revenue"; read by screen readers and the tooltip.
  name: string;
  type?: "area" | "column";
  color?: string;
  // A currency symbol for money; values then show two decimals.
  prefix?: string;
  height?: number;
};

export function TimeChart({ points, name, type = "area", color = "#2563eb", prefix = "", height = 280 }: TimeChartProps) {
  const money = prefix !== "";
  const options: Highcharts.Options = {
    ...base,
    chart: { ...base.chart, type, height },
    accessibility: { description: `${name} over time` },
    xAxis: {
      categories: points.map((p) => p.label),
      tickInterval: Math.max(1, Math.ceil(points.length / 8)),
      lineColor: GRID,
      tickLength: 0,
      labels: { style: { color: TEXT, fontSize: "11px" } },
      crosshair: type === "area" ? { color: "#cbd5e1", dashStyle: "ShortDash", width: 1 } : false,
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: GRID,
      min: 0,
      allowDecimals: money,
      labels: { style: { color: TEXT, fontSize: "11px" }, format: `${prefix}{value}` },
    },
    tooltip: {
      ...base.tooltip,
      headerFormat: '<span style="font-size:11px;opacity:0.75">{point.key}</span><br/>',
      pointFormat: `<b>${prefix}{point.y:,.${money ? 2 : 0}f}</b> ${money ? "" : name.toLowerCase()}`,
    },
    plotOptions: {
      area: {
        lineWidth: 2.5,
        // Dots only while there are few enough points to tell them apart.
        marker: { enabled: points.length <= 31, radius: 3, symbol: "circle" },
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, Highcharts.color(color).setOpacity(0.25).get("rgba") as string],
            [1, Highcharts.color(color).setOpacity(0).get("rgba") as string],
          ],
        },
      },
      column: { borderRadius: 4, borderWidth: 0, maxPointWidth: 28, pointPadding: 0.12, groupPadding: 0.08 },
    },
    series: [{ type, name, color, data: points.map((p) => p.value) }],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}

export type DonutChartProps = {
  slices: { name: string; value: number; color: string }[];
  name: string;
  // Big figure and caption in the middle.
  total: string;
  caption: string;
  height?: number;
};

export function DonutChart({ slices, name, total, caption, height = 220 }: DonutChartProps) {
  const options: Highcharts.Options = {
    ...base,
    chart: { ...base.chart, type: "pie", height },
    accessibility: { description: name },
    title: {
      text: `<span style="font-size:22px;font-weight:700;color:#0f2a5c">${total}</span><br/><span style="font-size:11px;font-weight:400;color:${TEXT}">${caption}</span>`,
      verticalAlign: "middle",
      floating: true,
      y: 12,
    },
    tooltip: { ...base.tooltip, headerFormat: "", pointFormat: "{point.name}: <b>{point.y:,.0f}</b> ({point.percentage:.0f}%)" },
    plotOptions: {
      pie: { innerSize: "72%", borderWidth: 3, borderColor: "#ffffff", borderRadius: 6, dataLabels: { enabled: false } },
    },
    series: [{ type: "pie", name, data: slices.map((s) => ({ name: s.name, y: s.value, color: s.color })) }],
  };
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
