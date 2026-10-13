import { describe, expect, it } from "vitest";
import { checkCoupon, splitPence, type CouponRules, type PricedLine } from "@/lib/commerce";

const now = new Date("2026-10-13T12:00:00Z");
const day = 86_400_000;
const rules = (over: Partial<CouponRules> = {}): CouponRules => ({
  code: "SAVE10",
  discountType: "PERCENTAGE",
  value: 10,
  active: true,
  startsAt: null,
  expiresAt: null,
  usageLimit: null,
  perUserLimit: null,
  minSpendPence: null,
  courseIds: [],
  categoryIds: [],
  userIds: [],
  ...over,
});
const lines: PricedLine[] = [
  { courseId: 1, categoryId: 10, pricePence: 5000 },
  { courseId: 2, categoryId: 20, pricePence: 3000 },
];
const check = (over: Partial<CouponRules> | null, usage = { total: 0, byUser: 0 }, cart = lines) =>
  checkCoupon({ rules: over === null ? null : rules(over), lines: cart, usage, now });

describe("checkCoupon refusals", () => {
  it.each([
    ["unknown", null, undefined],
    ["inactive", { active: false }, undefined],
    ["not_started", { startsAt: new Date(now.getTime() + day) }, undefined],
    ["expired", { expiresAt: new Date(now.getTime() - day) }, undefined],
    ["not_applicable", { courseIds: [99] }, undefined],
    ["min_spend", { minSpendPence: 8100 }, undefined],
    ["already_used", { perUserLimit: 1 }, { total: 1, byUser: 1 }],
    ["usage_limit", { usageLimit: 5 }, { total: 5, byUser: 0 }],
  ] as const)("refuses as %s", (reason, over, usage) => {
    expect(check(over as Partial<CouponRules> | null, usage)).toMatchObject({ ok: false, reason });
  });
});

describe("checkCoupon discounts", () => {
  it("takes a percentage off the whole cart", () => {
    expect(check({})).toMatchObject({ ok: true, discountPence: 800, lineDiscounts: [500, 300] });
  });
  it("discounts only matching lines and tests minimum spend against them", () => {
    expect(check({ categoryIds: [20] })).toMatchObject({ ok: true, lineDiscounts: [0, 300] });
    expect(check({ categoryIds: [20], minSpendPence: 4000 })).toMatchObject({ ok: false, reason: "min_spend" });
  });
  it("caps a fixed amount at the matching subtotal", () => {
    expect(check({ discountType: "FIXED", value: 100, courseIds: [2] })).toMatchObject({ ok: true, discountPence: 3000, lineDiscounts: [0, 3000] });
  });
  it("leaves nothing to pay for a 100% coupon", () => {
    const result = check({ value: 100 });
    expect(result.ok && result.pricing.totalPence).toBe(0);
  });
});

describe("splitPence", () => {
  it.each([
    [100, [1, 1, 1]],
    [1, [3, 3]],
    [7, [5000, 3000, 1999]],
    [0, [10, 20]],
  ])("splits %i exactly across %j", (total, weights) => {
    const shares = splitPence(total, weights);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
    expect(shares.every((s) => Number.isInteger(s) && s >= 0)).toBe(true);
  });
  it("gives leftover pence to the largest remainders, earlier first on a tie", () => {
    expect(splitPence(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
});

describe("personal coupons", () => {
  const personal = rules({ userIds: [7, 9] });
  const use = (userId: number | null) => checkCoupon({ rules: personal, lines, usage: { total: 0, byUser: 0 }, userId, now });

  it("works for a listed learner", () => {
    expect(use(9).ok).toBe(true);
  });

  it("is refused for anyone else and when signed out", () => {
    expect(use(8)).toMatchObject({ ok: false, reason: "not_eligible" });
    expect(use(null)).toMatchObject({ ok: false, reason: "not_eligible" });
  });
});
