import { describe, expect, it } from "vitest";
import { groupByAge, notificationKind, timeAgo } from "@/lib/notification";

const now = new Date(2026, 9, 13, 15, 0);
const at = (daysAgo: number, hour = 12) => ({ createdAt: new Date(2026, 9, 13 - daysAgo, hour) });

describe("groupByAge", () => {
  it("splits into today, this week and earlier, leaving out empty groups", () => {
    const groups = groupByAge([at(0, 1), at(1), at(6), at(7)], now);
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([["Today", 1], ["This week", 2], ["Earlier", 1]]);
    expect(groupByAge([at(30)], now).map((g) => g.group)).toEqual(["Earlier"]);
  });
});

describe("timeAgo and notificationKind", () => {
  it("words recent times and falls back to a date", () => {
    expect(timeAgo(new Date(2026, 9, 13, 14, 55), now)).toBe("5m ago");
    expect(timeAgo(new Date(2026, 9, 13, 12, 0), now)).toBe("3h ago");
    expect(timeAgo(new Date(2026, 9, 11, 15, 0), now)).toBe("2d ago");
    expect(timeAgo(new Date(2026, 8, 1, 15, 0), now)).toBe("1 Sept 2026");
  });

  it("marks bad news as a problem", () => {
    expect(notificationKind("order.failed")).toBe("problem");
    expect(notificationKind("order.paid")).toBe("order");
    expect(notificationKind("coupon.personal")).toBe("offer");
  });
});
