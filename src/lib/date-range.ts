import { firstParam, type SearchParams } from "@/lib/table-params";

export const DATE_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["value"];

export const DEFAULT_DATE_RANGE: DateRangePreset = "30d";

// Custom ranges longer than this are cut short, so charts stay bounded.
const MAX_DAYS = 366;

export type DateRange = {
  preset: DateRangePreset;
  label: string;
  // Start of the first day (inclusive) and start of the day after the last (exclusive).
  from: Date;
  to: Date;
  // Same-length period immediately before, for "versus previous period".
  previousFrom: Date;
  previousTo: Date;
  days: number;
  // Raw custom values, for refilling the form.
  customFrom?: string;
  customTo?: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function parseDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects overflow such as 2026-02-31.
  return date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
}

export function formatDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Reads `range` (and `from` / `to` for custom) from the URL; anything invalid
// falls back to the default preset.
export function parseDateRange(params: SearchParams, now = new Date()): DateRange {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const requested = firstParam(params.range);
  let preset: DateRangePreset =
    DATE_RANGE_PRESETS.find((p) => p.value === requested)?.value ?? DEFAULT_DATE_RANGE;

  let from: Date;
  let to: Date;
  let customFrom: string | undefined;
  let customTo: string | undefined;

  if (preset === "custom") {
    customFrom = firstParam(params.from);
    customTo = firstParam(params.to);
    let start = parseDateInput(customFrom);
    let end = parseDateInput(customTo);
    if (!start && !end) {
      preset = DEFAULT_DATE_RANGE;
    } else {
      start ??= addDays(end!, -29);
      end ??= today;
      if (start > end) [start, end] = [end, start];
      from = start;
      to = addDays(end, 1);
      if (Math.round((to.getTime() - from.getTime()) / 86_400_000) > MAX_DAYS) {
        from = addDays(to, -MAX_DAYS);
      }
    }
  }

  if (preset !== "custom") {
    customFrom = customTo = undefined;
    switch (preset) {
      case "today":
        from = today;
        to = tomorrow;
        break;
      case "yesterday":
        from = addDays(today, -1);
        to = today;
        break;
      case "7d":
        from = addDays(today, -6);
        to = tomorrow;
        break;
      case "90d":
        from = addDays(today, -89);
        to = tomorrow;
        break;
      case "year":
        from = new Date(today.getFullYear(), 0, 1);
        to = tomorrow;
        break;
      default:
        from = addDays(today, -29);
        to = tomorrow;
    }
  }

  from = from!;
  to = to!;
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const label =
    preset === "custom"
      ? `${formatDateInput(from)} to ${formatDateInput(addDays(to, -1))}`
      : DATE_RANGE_PRESETS.find((p) => p.value === preset)!.label;

  return {
    preset,
    label,
    from,
    to,
    previousFrom: addDays(from, -days),
    previousTo: from,
    days,
    customFrom,
    customTo,
  };
}
