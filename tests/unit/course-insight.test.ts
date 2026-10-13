import { describe, expect, it } from "vitest";
import { averageProgress, completionRate, lastMonths, netRevenue, progressBucket, progressSpread } from "@/lib/course-insight";

describe("progressBucket", () => {
  it("sorts by percentage, and completed wins", () => {
    expect(progressBucket({ status: "ACTIVE", progressPercent: 0 })).toBe("NOT_STARTED");
    expect(progressBucket({ status: "ACTIVE", progressPercent: 1 })).toBe("STARTED");
    expect(progressBucket({ status: "ACTIVE", progressPercent: 49 })).toBe("STARTED");
    expect(progressBucket({ status: "ACTIVE", progressPercent: 50 })).toBe("HALFWAY");
    expect(progressBucket({ status: "ACTIVE", progressPercent: 99 })).toBe("HALFWAY");
    expect(progressBucket({ status: "COMPLETED", progressPercent: 80 })).toBe("COMPLETED");
  });

  it("counts and shares the spread", () => {
    const spread = progressSpread([
      { status: "ACTIVE", progressPercent: 0 },
      { status: "ACTIVE", progressPercent: 30 },
      { status: "COMPLETED", progressPercent: 100 },
      { status: "ACTIVE", progressPercent: 75 },
    ]);
    expect(spread.map((s) => s.count)).toEqual([1, 1, 1, 1]);
    expect(spread[0].percent).toBe(25);
  });
});

describe("rates and revenue", () => {
  it("handles an empty course", () => {
    expect(completionRate(0, 0)).toBe(0);
    expect(averageProgress([])).toBe(0);
  });

  it("rounds the completion rate and average", () => {
    expect(completionRate(1, 3)).toBe(33);
    expect(averageProgress([0, 50, 100, 25])).toBe(44);
  });

  it("subtracts refunds without float drift", () => {
    expect(netRevenue(0.3, 0.1)).toBe(0.2);
    expect(netRevenue(49, 49)).toBe(0);
  });

  it("lists twelve months ending now, across a year boundary", () => {
    const months = lastMonths(new Date(2026, 1, 10));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-03");
    expect(months[11]).toBe("2026-02");
  });
});
