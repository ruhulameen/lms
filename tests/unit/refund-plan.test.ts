import { describe, expect, it } from "vitest";
import { planRefund } from "@/lib/commerce";

const items = [
  { id: 1, totalPence: 4900, refunded: false },
  { id: 2, totalPence: 2500, refunded: false },
  { id: 3, totalPence: 0, refunded: false },
];
const plan = (over: Partial<Parameters<typeof planRefund>[0]> = {}) =>
  planRefund({ status: "PAID", items, refundedTotalPence: 0, itemIds: null, ...over });

describe("planRefund", () => {
  it("refunds the whole order and ends REFUNDED", () => {
    expect(plan()).toMatchObject({ ok: true, amountPence: 7400, itemIds: [1, 2, 3], refundedTotalPence: 7400, status: "REFUNDED" });
  });
  it("refunds chosen lines and ends PARTIALLY_REFUNDED", () => {
    expect(plan({ itemIds: [2] })).toMatchObject({ ok: true, amountPence: 2500, itemAmountsPence: [2500], status: "PARTIALLY_REFUNDED" });
  });
  it("finishes REFUNDED when the last lines are refunded, adding to the total", () => {
    const rest = items.map((i) => ({ ...i, refunded: i.id === 1 }));
    expect(plan({ status: "PARTIALLY_REFUNDED", items: rest, refundedTotalPence: 4900, itemIds: null })).toMatchObject({
      ok: true,
      amountPence: 2500,
      refundedTotalPence: 7400,
      status: "REFUNDED",
    });
  });
  it("refuses a line already refunded, an unknown line and an empty choice", () => {
    const first = items.map((i) => ({ ...i, refunded: i.id === 1 }));
    expect(plan({ items: first, status: "PARTIALLY_REFUNDED", itemIds: [1] })).toEqual({ ok: false, reason: "already_refunded" });
    expect(plan({ itemIds: [99] })).toEqual({ ok: false, reason: "unknown_item" });
    expect(plan({ items: items.map((i) => ({ ...i, refunded: true })), status: "PARTIALLY_REFUNDED" })).toEqual({ ok: false, reason: "nothing_selected" });
  });
  it("refuses orders that were never paid or are fully refunded", () => {
    expect(plan({ status: "PENDING" })).toEqual({ ok: false, reason: "not_refundable" });
    expect(plan({ status: "REFUNDED" })).toEqual({ ok: false, reason: "not_refundable" });
  });
  it("allows a zero-amount line", () => {
    expect(plan({ itemIds: [3] })).toMatchObject({ ok: true, amountPence: 0 });
  });
});
