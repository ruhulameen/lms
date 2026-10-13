import { describe, expect, it } from "vitest";
import { summariseOrders } from "@/lib/learner-insight";

describe("summariseOrders", () => {
  it("is zero for a learner with no orders", () => {
    expect(summariseOrders([])).toEqual({ orders: 0, paidOrders: 0, paid: 0, refunded: 0, lifetimeValue: 0 });
  });

  it("counts paid, partially refunded and refunded orders, but not unpaid ones", () => {
    const result = summariseOrders([
      { status: "PAID", total: 49, refundedTotal: 0 },
      { status: "PARTIALLY_REFUNDED", total: 100, refundedTotal: 30 },
      { status: "REFUNDED", total: 20, refundedTotal: 20 },
      { status: "PENDING", total: 80, refundedTotal: 0 },
      { status: "FAILED", total: 15, refundedTotal: 0 },
      { status: "CANCELLED", total: 10, refundedTotal: 0 },
    ]);
    expect(result).toEqual({ orders: 6, paidOrders: 3, paid: 169, refunded: 50, lifetimeValue: 119 });
  });

  it("adds pence without floating-point drift", () => {
    const result = summariseOrders([
      { status: "PAID", total: 0.1, refundedTotal: 0 },
      { status: "PAID", total: 0.2, refundedTotal: 0 },
    ]);
    expect(result.paid).toBe(0.3);
  });

  it("takes grouped rows by their count", () => {
    expect(summariseOrders([{ status: "PAID", total: 90, refundedTotal: 0, count: 3 }]).orders).toBe(3);
  });
});
