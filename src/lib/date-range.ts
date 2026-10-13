import { firstParam, type SearchParams } from "@/lib/table-params";

export const DATE_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["value"];

export const DEFAULT_DATE_RANGE: DateRangePreset = "this-month";

// Custom ranges longer than this are cut short (ten years).
const MAX_DAYS = 3660;
// Ranges up to this long are charted per day, longer ones per month.
const MAX_DAILY_BUCKETS = 92;

export type DateRange = {
  preset: DateRangePreset;
  label: string;
  // Start of the first day (inclusive) and start of the day after the last (exclusive).
  from: Date;
  to: Date;
  // Same-length period immediately before, for "versus previous period".
  previousFrom: Date;
  previousTo: Date;
  // False for "All time", which has nothing before it to compare with.
  compare: boolean;
  days: number;
  // How charts group the range.
  bucket: "day" | "month";
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

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000);

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "5 Jan 2026"
export const formatDay = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

// "1 Oct 2026 – 13 Oct 2026", or one date for a single day. `to` is exclusive.
export function formatRangeDates(from: Date, to: Date) {
  const last = addDays(to, -1);
  return from.getTime() === last.getTime() ? formatDay(from) : `${formatDay(from)} – ${formatDay(last)}`;
}

// Reads `range` (and `from` / `to` for custom) from the URL; anything invalid
// falls back to the default preset. Weeks start on Monday. "This week", "This
// month" and "This year" stop at today. `earliest` is where "All time" starts
// (the oldest record); without it All time is just today.
export function parseDateRange(params: SearchParams, now = new Date(), options: { earliest?: Date | null } = {}): DateRange {
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
      if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -MAX_DAYS);
    }
  }

  if (preset !== "custom") {
    customFrom = customTo = undefined;
    // Monday of this week.
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    const year = today.getFullYear();
    const month = today.getMonth();
    switch (preset) {
      case "today":
        [from, to] = [today, tomorrow];
        break;
      case "yesterday":
        [from, to] = [addDays(today, -1), today];
        break;
      case "this-week":
        [from, to] = [monday, tomorrow];
        break;
      case "last-week":
        [from, to] = [addDays(monday, -7), monday];
        break;
      case "last-month":
        [from, to] = [new Date(year, month - 1, 1), new Date(year, month, 1)];
        break;
      case "this-year":
        [from, to] = [new Date(year, 0, 1), tomorrow];
        break;
      case "last-year":
        [from, to] = [new Date(year - 1, 0, 1), new Date(year, 0, 1)];
        break;
      case "all": {
        const first = options.earliest ? startOfDay(options.earliest) : today;
        [from, to] = [first < today ? first : today, tomorrow];
        break;
      }
      default:
        [from, to] = [new Date(year, month, 1), tomorrow];
    }
  }

  from = from!;
  to = to!;
  const days = daysBetween(from, to);
  const label = preset === "custom" ? formatRangeDates(from, to) : DATE_RANGE_PRESETS.find((p) => p.value === preset)!.label;

  return {
    preset,
    label,
    from,
    to,
    previousFrom: addDays(from, -days),
    previousTo: from,
    compare: preset !== "all",
    days,
    bucket: days > MAX_DAILY_BUCKETS ? "month" : "day",
    customFrom,
    customTo,
  };
}

export type SeriesPoint = { key: string; label: string; value: number };

// One point per day or month of the range (zeros included), with the values
// of the items that fall in each added up. Items outside the range are ignored.
export function fillBuckets(range: Pick<DateRange, "from" | "to" | "bucket">, items: readonly { at: Date; value: number }[]): SeriesPoint[] {
  const monthly = range.bucket === "month";
  const keyOf = (d: Date) => (monthly ? formatDateInput(d).slice(0, 7) : formatDateInput(d));
  const points = new Map<string, SeriesPoint>();
  const last = addDays(range.to, -1);
  for (
    let d = monthly ? new Date(range.from.getFullYear(), range.from.getMonth(), 1) : range.from;
    d <= last;
    d = monthly ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : addDays(d, 1)
  ) {
    const label = monthly ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    points.set(keyOf(d), { key: keyOf(d), label, value: 0 });
  }
  for (const item of items) {
    if (item.at < range.from || item.at >= range.to) continue;
    const point = points.get(keyOf(item.at));
    if (point) point.value += item.value;
  }
  return [...points.values()];
}

// Change against the previous period as a whole percentage, or null when
// there is nothing to compare with (previous was zero).
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
