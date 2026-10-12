import { describe, expect, it } from "vitest";
import { ORDER_NUMBER_PATTERN, canTransition, generateOrderNumber, isOrderExpired, priceOrder, type OrderStatusValue } from "@/lib/commerce";

describe("priceOrder", () => {
  const lines = [
    { courseId: 1, categoryId: null, pricePence: 4900 },
    { courseId: 2, categoryId: null, pricePence: 2500 },
  ];
  it("adds up the lines with no coupon", () => {
    expect(priceOrder(lines)).toMatchObject({ subtotalPence: 7400, discountPence: 0, totalPence: 7400 });
  });
  it("subtracts each line's discount, never below zero", () => {
    const priced = priceOrder(lines, [1000, 9999]);
    expect(priced.lines.map((l) => l.totalPence)).toEqual([3900, 0]);
    expect(priced).toMatchObject({ discountPence: 3500, totalPence: 3900 });
  });
});

describe("canTransition", () => {
  it.each<[OrderStatusValue, OrderStatusValue, boolean]>([
    ["PENDING", "PAID", true],
    ["PENDING", "REFUNDED", false],
    ["FAILED", "PAID", true],
    ["CANCELLED", "PAID", true],
    ["PAID", "PARTIALLY_REFUNDED", true],
    ["PAID", "CANCELLED", false],
    ["PARTIALLY_REFUNDED", "REFUNDED", true],
    ["REFUNDED", "PAID", false],
  ])("%s to %s is %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});

describe("isOrderExpired", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("expires a pending order at its time", () => {
    expect(isOrderExpired({ status: "PENDING", expiresAt: new Date("2026-10-13T11:59:00Z") }, now)).toBe(true);
    expect(isOrderExpired({ status: "PENDING", expiresAt: new Date("2026-10-13T12:01:00Z") }, now)).toBe(false);
  });
  it("never expires without a time or once settled", () => {
    expect(isOrderExpired({ status: "PENDING", expiresAt: null }, now)).toBe(false);
    expect(isOrderExpired({ status: "PAID", expiresAt: new Date("2026-01-01") }, now)).toBe(false);
  });
});

describe("generateOrderNumber", () => {
  it("has the date and a six character suffix", () => {
    const number = generateOrderNumber(new Date("2026-10-13T12:00:00Z"));
    expect(number).toMatch(ORDER_NUMBER_PATTERN);
    expect(number.startsWith("ORD-20261013-")).toBe(true);
  });
  it("skips random bytes that would bias the alphabet", () => {
    const bytes = [255, 0, 1, 2, 3, 4, 5];
    expect(generateOrderNumber(new Date("2026-10-13T00:00:00Z"), () => new Uint8Array(bytes))).toBe("ORD-20261013-234567");
  });
});
