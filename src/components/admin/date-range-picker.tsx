"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRange as PickedRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_RANGE_PRESETS, formatDateInput, formatDay, parseDateInput, type DateRangePreset } from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  // The page the range belongs to; the choice goes into its URL.
  basePath: string;
  preset: DateRangePreset;
  // First and last day shown, as YYYY-MM-DD.
  from: string;
  to: string;
};

// One button that opens the ready-made ranges next to a calendar for a custom
// one. A ready-made range applies at once; a custom one on "Apply".
export function DateRangePicker({ basePath, preset, from, to }: DateRangePickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current: PickedRange = { from: parseDateInput(from), to: parseDateInput(to) };
  const [picked, setPicked] = useState<PickedRange | undefined>(current);
  const [custom, setCustom] = useState(preset === "custom");

  const label = DATE_RANGE_PRESETS.find((p) => p.value === preset)!.label;
  const dates = from === to ? formatDay(current.from!) : `${formatDay(current.from!)} – ${formatDay(current.to!)}`;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPicked(current);
      setCustom(preset === "custom");
    }
  }

  function go(query: string) {
    setOpen(false);
    router.push(`${basePath}?${query}`);
  }

  function apply() {
    if (!picked?.from) return;
    go(`range=custom&from=${formatDateInput(picked.from)}&to=${formatDateInput(picked.to ?? picked.from)}`);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button variant="outline" className="h-10 justify-start gap-2 bg-white px-3 font-normal" />}>
        <CalendarDays className="text-slate-500" aria-hidden />
        <span className="font-semibold text-slate-900">{preset === "custom" ? "Custom" : label}</span>
        <span className="hidden text-slate-500 sm:inline">{dates}</span>
        <ChevronDown className="ml-1 text-slate-400" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0 sm:flex-row">
        <ul aria-label="Ready-made ranges" className="flex flex-wrap gap-1 border-b p-2 sm:w-40 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0">
          {DATE_RANGE_PRESETS.map((p) => {
            const active = p.value === "custom" ? custom : !custom && p.value === preset;
            return (
              <li key={p.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => (p.value === "custom" ? setCustom(true) : go(`range=${p.value}`))}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    active ? "bg-blue-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {p.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex min-w-0 flex-col">
          <div className="overflow-x-auto">
            <Calendar
              mode="range"
              numberOfMonths={2}
              weekStartsOn={1}
              defaultMonth={current.to ? new Date(current.to.getFullYear(), current.to.getMonth() - 1, 1) : undefined}
              showOutsideDays={false}
              selected={picked}
              // A click on a finished range starts a new one from that day.
              onSelect={(range, day) => {
                setPicked(picked?.from && picked.to ? { from: day, to: undefined } : range);
                setCustom(true);
              }}
              disabled={{ after: new Date() }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-2.5">
            <p className="text-xs text-slate-500" aria-live="polite">
              {picked?.from ? `${formatDay(picked.from)} – ${formatDay(picked.to ?? picked.from)}` : "Choose a start and an end date"}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={apply} disabled={!custom || !picked?.from}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
