import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from "lucide-react";
import { percentChange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
};

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof tones;
  // Shows the change against the previous period. Omit `previous` (or pass
  // null) when there is nothing to compare with.
  current?: number;
  previous?: number | null;
  // A fall is good news for this figure (refunds).
  lowerIsBetter?: boolean;
  // Small print under the value, next to the change.
  note?: ReactNode;
};

// One headline figure: label, icon, value, and how it moved.
export function StatCard({ label, value, icon: Icon, tone = "blue", current, previous, lowerIsBetter, note }: StatCardProps) {
  const compared = current !== undefined && previous !== undefined && previous !== null;
  const change = compared ? percentChange(current, previous) : null;
  const direction = !compared || current === previous ? "flat" : current > previous ? "up" : "down";
  const good = direction === "flat" ? null : (direction === "up") !== Boolean(lowerIsBetter);
  const Arrow = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <section aria-label={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,42,92,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-500">{label}</h2>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-[28px] leading-none font-bold tracking-tight text-[#0f2a5c] tabular-nums">{value}</p>
      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {compared && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
              good === null ? "bg-slate-100 text-slate-600" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            <Arrow className="size-3.5" aria-hidden />
            <span className="sr-only">{direction === "up" ? "Up" : direction === "down" ? "Down" : "No change"}</span>
            {direction === "flat" ? "0%" : change === null ? "New" : `${Math.abs(change)}%`}
          </span>
        )}
        <span className="text-slate-500">{note ?? (compared ? "vs previous period" : null)}</span>
      </div>
    </section>
  );
}
