import { describe, expect, it } from "vitest";
import { fillBuckets, formatDateInput, parseDateInput, parseDateRange, percentChange } from "@/lib/date-range";

// Wednesday 15 July 2026, midday, local time.
const now = new Date(2026, 6, 15, 12, 30);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const span = (range: string, extra = {}) => {
  const r = parseDateRange({ range, ...extra }, now, { earliest: day(2025, 3, 10) });
  return [r.from, r.to];
};

describe("parseDateInput", () => {
  it("parses real dates and rejects malformed or overflowing ones", () => {
    expect(parseDateInput("2026-02-28")).toEqual(day(2026, 2, 28));
    for (const value of [undefined, "", "2026-2-3", "2026-02-31", "abc"]) expect(parseDateInput(value)).toBeUndefined();
    expect(formatDateInput(day(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("parseDateRange presets", () => {
  it("defaults to this month, up to today", () => {
    const r = parseDateRange({}, now);
    expect([r.preset, r.from, r.to, r.days]).toEqual(["this-month", day(2026, 7, 1), day(2026, 7, 16), 15]);
    expect(parseDateRange({ range: "decade" }, now).preset).toBe("this-month");
  });

  it("works out each preset, with weeks starting on Monday", () => {
    expect(span("today")).toEqual([day(2026, 7, 15), day(2026, 7, 16)]);
    expect(span("yesterday")).toEqual([day(2026, 7, 14), day(2026, 7, 15)]);
    expect(span("this-week")).toEqual([day(2026, 7, 13), day(2026, 7, 16)]);
    expect(span("last-week")).toEqual([day(2026, 7, 6), day(2026, 7, 13)]);
    expect(span("last-month")).toEqual([day(2026, 6, 1), day(2026, 7, 1)]);
    expect(span("this-year")).toEqual([day(2026, 1, 1), day(2026, 7, 16)]);
    expect(span("last-year")).toEqual([day(2025, 1, 1), day(2026, 1, 1)]);
    expect(span("all")).toEqual([day(2025, 3, 10), day(2026, 7, 16)]);
  });

  it("compares with the same-length period before, except for all time", () => {
    const r = parseDateRange({ range: "last-week" }, now);
    expect([r.previousFrom, r.previousTo, r.compare]).toEqual([day(2026, 6, 29), day(2026, 7, 6), true]);
    expect(parseDateRange({ range: "all" }, now).compare).toBe(false);
  });

  it("charts short ranges by day and long ones by month", () => {
    expect(parseDateRange({ range: "this-month" }, now).bucket).toBe("day");
    expect(parseDateRange({ range: "this-year" }, now).bucket).toBe("month");
  });
});

describe("parseDateRange custom", () => {
  it("includes the last day, swaps a reversed range and labels it", () => {
    const r = parseDateRange({ range: "custom", from: "2026-07-10", to: "2026-07-01" }, now);
    expect([r.preset, r.from, r.to, r.days]).toEqual(["custom", day(2026, 7, 1), day(2026, 7, 11), 10]);
    expect(r.label).toBe("1 Jul 2026 – 10 Jul 2026");
  });

  it("fills a missing side and falls back when both are invalid", () => {
    expect(parseDateRange({ range: "custom", from: "2026-07-01" }, now).to).toEqual(day(2026, 7, 16));
    expect(parseDateRange({ range: "custom", from: "nope", to: "2026-02-31" }, now).preset).toBe("this-month");
  });
});

describe("fillBuckets and percentChange", () => {
  it("adds values into days, keeping empty days", () => {
    const range = parseDateRange({ range: "custom", from: "2026-07-01", to: "2026-07-03" }, now);
    const points = fillBuckets(range, [
      { at: new Date(2026, 6, 1, 9), value: 2 },
      { at: new Date(2026, 6, 1, 23), value: 3 },
      { at: new Date(2026, 6, 3, 1), value: 1 },
      { at: new Date(2026, 6, 4, 1), value: 99 },
    ]);
    expect(points.map((p) => [p.label, p.value])).toEqual([["1 Jul", 5], ["2 Jul", 0], ["3 Jul", 1]]);
  });

  it("adds values into months for long ranges", () => {
    const range = parseDateRange({ range: "last-year" }, now);
    const points = fillBuckets(range, [{ at: day(2025, 2, 14), value: 4 }]);
    expect(points).toHaveLength(12);
    expect(points[1]).toEqual({ key: "2025-02", label: "Feb 2025", value: 4 });
  });

  it("gives a whole percentage, or null from zero", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
  });
});
