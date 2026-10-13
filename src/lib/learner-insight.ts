import { toPence, toPounds } from "@/lib/commerce";

// Money figures for one learner (or a page of them). Pure, so it is tested
// without the database.
//
// Which orders count: an order has been paid if its status is PAID,
// PARTIALLY_REFUNDED or REFUNDED. PENDING, FAILED and CANCELLED orders took no
// money. `total` never changes after a refund; settleRefund (services/refund.ts)
// adds each successful refund to `refundedTotal` and moves the status on.
//   lifetime value = sum of `total` over paid orders - sum of `refundedTotal`
// Amounts are added as whole pence so nothing drifts as floating-point pounds.

export const PAID_ORDER_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] as const;

export const isPaidOrderStatus = (status: string) => (PAID_ORDER_STATUSES as readonly string[]).includes(status);

export type InsightOrder = {
  status: string;
  total: number;
  refundedTotal: number;
  // How many orders this row stands for (a grouped row); one by default.
  count?: number;
};

export type OrderInsight = {
  orders: number;
  paidOrders: number;
  // Money taken, before refunds.
  paid: number;
  refunded: number;
  lifetimeValue: number;
};

export function summariseOrders(orders: InsightOrder[]): OrderInsight {
  let count = 0;
  let paidCount = 0;
  let paidPence = 0;
  let refundedPence = 0;
  for (const order of orders) {
    const n = order.count ?? 1;
    count += n;
    if (!isPaidOrderStatus(order.status)) continue;
    paidCount += n;
    paidPence += toPence(order.total);
    refundedPence += toPence(order.refundedTotal);
  }
  return {
    orders: count,
    paidOrders: paidCount,
    paid: toPounds(paidPence),
    refunded: toPounds(refundedPence),
    lifetimeValue: toPounds(paidPence - refundedPence),
  };
}
