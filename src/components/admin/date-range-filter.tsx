import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATE_RANGE_PRESETS, formatDateInput, type DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangeFilterProps = {
  basePath: string;
  range: DateRange;
};

// Preset links plus a GET form for a custom range; no client state.
export function DateRangeFilter({ basePath, range }: DateRangeFilterProps) {
  const presets = DATE_RANGE_PRESETS.filter((p) => p.value !== "custom");
  const lastDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
      <nav aria-label="Date range" className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = range.preset === preset.value;
          return (
            <Link
              key={preset.value}
              href={`${basePath}?range=${preset.value}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </nav>
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="range" value="custom" />
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          From
          <Input
            type="date"
            name="from"
            defaultValue={range.customFrom ?? formatDateInput(range.from)}
            className="w-40"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          To
          <Input
            type="date"
            name="to"
            defaultValue={range.customTo ?? formatDateInput(lastDay)}
            className="w-40"
          />
        </label>
        <Button type="submit" variant={range.preset === "custom" ? "default" : "outline"}>
          Custom range
        </Button>
      </form>
    </div>
  );
}
