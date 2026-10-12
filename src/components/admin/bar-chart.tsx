type BarChartProps = {
  data: { date: string; count: number }[];
  // Describes the chart for screen readers.
  label: string;
  // Hover text for one bar and the "peak" caption; sign-ups by default.
  describe?: (d: { date: string; count: number }) => string;
  formatPeak?: (max: number) => string;
};

const WIDTH = 600;
const HEIGHT = 160;

// Plain SVG bars, one per day. Titles give per-bar values on hover.
export function BarChart({ data, label, describe, formatPeak }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const slot = WIDTH / Math.max(data.length, 1);
  const barWidth = Math.max(slot * 0.7, 1);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
        className="h-40 w-full"
        preserveAspectRatio="none"
      >
        <line x1="0" y1={HEIGHT - 0.5} x2={WIDTH} y2={HEIGHT - 0.5} className="stroke-slate-300" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const h = d.count === 0 ? 0 : Math.max((d.count / max) * (HEIGHT - 8), 2);
          return (
            <rect
              key={d.date}
              x={i * slot + (slot - barWidth) / 2}
              y={HEIGHT - h}
              width={barWidth}
              height={h}
              rx="1"
              className="fill-blue-600"
            >
              <title>{describe ? describe(d) : `${d.date}: ${d.count} sign-up${d.count === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{data[0]?.date}</span>
        <span>Peak: {formatPeak ? formatPeak(max) : `${max === 1 && data.every((d) => d.count === 0) ? 0 : max} per day`}</span>
        <span>{data.at(-1)?.date}</span>
      </figcaption>
    </figure>
  );
}
