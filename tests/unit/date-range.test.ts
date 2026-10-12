import { describe, expect, it } from "vitest";
import { formatDateInput, parseDateInput, parseDateRange } from "@/lib/date-range";

// Wednesday 15 July 2026, midday, local time.
const now = new Date(2026, 6, 15, 12, 30);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("parseDateInput", () => {
  it("parses real dates", () => {
    expect(parseDateInput("2026-02-28")).toEqual(day(2026, 2, 28));
  });

  it("rejects malformed and overflowing dates", () => {
    for (const value of [undefined, "", "2026-2-3", "26-02-03", "2026-02-31", "2026-13-01", "abc"]) {
      expect(parseDateInput(value)).toBeUndefined();
    }
  });

  it("round-trips through formatDateInput", () => {
    expect(formatDateInput(day(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("parseDateRange presets", () => {
  it("defaults to the last 30 days", () => {
    const r = parseDateRange({}, now);
    expect(r.preset).toBe("30d");
    expect(r.days).toBe(30);
    expect(r.from).toEqual(day(2026, 6, 16));
    expect(r.to).toEqual(day(2026, 7, 16));
  });

  it("today covers one day", () => {
    const r = parseDateRange({ range: "today" }, now);
    expect([r.from, r.to, r.days]).toEqual([day(2026, 7, 15), day(2026, 7, 16), 1]);
    expect(r.previousFrom).toEqual(day(2026, 7, 14));
    expect(r.previousTo).toEqual(day(2026, 7, 15));
  });

  it("yesterday ends at the start of today", () => {
    const r = parseDateRange({ range: "yesterday" }, now);
    expect([r.from, r.to, r.days]).toEqual([day(2026, 7, 14), day(2026, 7, 15), 1]);
  });

  it("7d and 90d include today", () => {
    const week = parseDateRange({ range: "7d" }, now);
    expect([week.from, week.to, week.days]).toEqual([day(2026, 7, 9), day(2026, 7, 16), 7]);
    const quarter = parseDateRange({ range: "90d" }, now);
    expect(quarter.days).toBe(90);
    expect(quarter.to).toEqual(day(2026, 7, 16));
  });

  it("year starts on 1 January", () => {
    const r = parseDateRange({ range: "year" }, now);
    expect(r.from).toEqual(day(2026, 1, 1));
    expect(r.to).toEqual(day(2026, 7, 16));
    expect(r.days).toBe(196);
  });

  it("falls back to the default for an unknown preset and uses the first of repeated params", () => {
    expect(parseDateRange({ range: "decade" }, now).preset).toBe("30d");
    expect(parseDateRange({ range: ["7d", "90d"] }, now).preset).toBe("7d");
  });

  it("labels presets by name", () => {
    expect(parseDateRange({ range: "7d" }, now).label).toBe("7 Days");
  });

  it("makes the previous period the same length and directly before", () => {
    for (const range of ["today", "yesterday", "7d", "30d", "90d", "year"]) {
      const r = parseDateRange({ range }, now);
      expect(r.previousTo).toEqual(r.from);
      expect(r.previousTo.getTime() - r.previousFrom.getTime()).toBe(r.to.getTime() - r.from.getTime());
    }
  });
});

describe("parseDateRange custom", () => {
  it("includes the last day, and echoes the raw values", () => {
    const r = parseDateRange({ range: "custom", from: "2026-07-01", to: "2026-07-10" }, now);
    expect(r.preset).toBe("custom");
    expect([r.from, r.to, r.days]).toEqual([day(2026, 7, 1), day(2026, 7, 11), 10]);
    expect(r.label).toBe("2026-07-01 to 2026-07-10");
    expect([r.customFrom, r.customTo]).toEqual(["2026-07-01", "2026-07-10"]);
    expect(r.previousFrom).toEqual(day(2026, 6, 21));
  });

  it("swaps a reversed range", () => {
    const r = parseDateRange({ range: "custom", from: "2026-07-10", to: "2026-07-01" }, now);
    expect([r.from, r.to]).toEqual([day(2026, 7, 1), day(2026, 7, 11)]);
  });

  it("fills a missing end with today and a missing start with 30 days before the end", () => {
    const noEnd = parseDateRange({ range: "custom", from: "2026-07-01" }, now);
    expect([noEnd.from, noEnd.to]).toEqual([day(2026, 7, 1), day(2026, 7, 16)]);
    const noStart = parseDateRange({ range: "custom", to: "2026-07-30" }, now);
    expect([noStart.from, noStart.days]).toEqual([day(2026, 7, 1), 30]);
  });

  it("falls back to the default preset when both dates are missing or invalid", () => {
    for (const params of [
      { range: "custom" },
      { range: "custom", from: "nope", to: "2026-02-31" },
    ]) {
      const r = parseDateRange(params, now);
      expect(r.preset).toBe("30d");
      expect(r.customFrom).toBeUndefined();
    }
  });

  it("uses the valid side when only one date is valid", () => {
    const r = parseDateRange({ range: "custom", from: "bad", to: "2026-07-10" }, now);
    expect(r.preset).toBe("custom");
    expect(r.to).toEqual(day(2026, 7, 11));
  });

  it("caps long ranges at 366 days, keeping the end", () => {
    const r = parseDateRange({ range: "custom", from: "2020-01-01", to: "2026-07-10" }, now);
    expect(r.days).toBe(366);
    expect(r.to).toEqual(day(2026, 7, 11));
    expect(r.from).toEqual(day(2025, 7, 10));
  });

  it("allows exactly 366 days", () => {
    const r = parseDateRange({ range: "custom", from: "2025-07-10", to: "2026-07-10" }, now);
    expect(r.days).toBe(366);
  });

  it("handles a single-day custom range", () => {
    const r = parseDateRange({ range: "custom", from: "2026-07-05", to: "2026-07-05" }, now);
    expect(r.days).toBe(1);
  });
});
