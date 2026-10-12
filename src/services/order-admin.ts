import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isPaidStatus, orderStatuses, type OrderStatusValue } from "@/lib/commerce";
import { db } from "@/lib/db";
import { logActivity } from "@/services/activity";
import { addOrderEvent, getOrderById } from "@/services/order";
import { cancelPendingOrder as cancelPendingOrderSafely } from "@/services/payment";

// Orders from the admin's side: the list, one order with everything around it,
// staff notes and cancelling a pending order. Call after the permission checks
// (order.view for reading, order.manage for changes). Money is in pounds as
// numbers. Refunds are in src/services/refund.ts.

export const ORDER_PAGE_SIZE = 15;
export const ORDER_SORT_KEYS = ["number", "date", "learner", "total", "status"] as const;
export type OrderSortKey = (typeof ORDER_SORT_KEYS)[number];

export type OrderListFilters = {
  // Order number, learner name or email, or a course title on the order.
  search?: string;
  status?: OrderStatusValue;
  userId?: number;
  couponId?: number;
  // Inclusive start of the first day, exclusive start of the day after the last.
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sort: OrderSortKey;
  order: "asc" | "desc";
};

const PAID_STATUSES = orderStatuses.filter(isPaidStatus);

function listWhere(filters: OrderListFilters): Prisma.OrderWhereInput {
  const search = filters.search?.trim();
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.couponId ? { couponId: filters.couponId } : {}),
    ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lt: filters.to } } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search } },
            { email: { contains: search } },
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
            { items: { some: { courseTitle: { contains: search } } } },
          ],
        }
      : {}),
  };
}

export type OrderRow = {
  id: number;
  orderNumber: string;
  createdAt: Date;
  status: OrderStatusValue;
  total: number;
  couponCode: string | null;
  learner: { id: number; name: string; email: string };
  courses: string[];
  payments: { provider: string; status: string; cardBrand: string | null; cardLast4: string | null }[];
};

// Revenue-like numbers for any order filter: how many orders, what the paid
// ones add up to (PAID, PARTIALLY_REFUNDED and REFUNDED are gross, before
// refunds) and what has been refunded. The admin dashboard calls this with a
// date range.
export async function getOrderSummary(filters: Pick<OrderListFilters, "search" | "status" | "userId" | "couponId" | "from" | "to"> = {}) {
  const where = listWhere({ ...filters, sort: "date", order: "desc" });
  const [count, paid, refunded] = await Promise.all([
    db.order.count({ where }),
    db.order.aggregate({ where: { AND: [where, { status: { in: PAID_STATUSES } }] }, _sum: { total: true }, _count: { _all: true } }),
    db.order.aggregate({ where, _sum: { refundedTotal: true } }),
  ]);
  return {
    orders: count,
    paidOrders: paid._count._all,
    paidTotal: Number(paid._sum.total ?? 0),
    refundedTotal: Number(refunded._sum.refundedTotal ?? 0),
  };
}

export async function listOrders(filters: OrderListFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = filters.pageSize ?? ORDER_PAGE_SIZE;
  const where = listWhere(filters);
  const dir = filters.order;
  const orderBy: Prisma.OrderOrderByWithRelationInput[] = [
    filters.sort === "number"
      ? { orderNumber: dir }
      : filters.sort === "learner"
        ? { user: { name: dir } }
        : filters.sort === "total"
          ? { total: dir }
          : filters.sort === "status"
            ? { status: dir }
            : { createdAt: dir },
    { id: "desc" },
  ];

  const [rows, total, summary] = await Promise.all([
    db.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        total: true,
        couponCode: true,
        user: { select: { id: true, name: true, email: true } },
        items: { orderBy: { id: "asc" }, select: { courseTitle: true } },
        payments: { orderBy: { id: "desc" }, select: { provider: true, status: true, cardBrand: true, cardLast4: true } },
      },
    }),
    db.order.count({ where }),
    getOrderSummary(filters),
  ]);

  return {
    rows: rows.map(
      (o): OrderRow => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        total: Number(o.total),
        couponCode: o.couponCode,
        learner: o.user,
        courses: o.items.map((i) => i.courseTitle),
        payments: o.payments,
      }),
    ),
    total,
    page,
    pageSize,
    summary,
  };
}

// A learner's latest orders for their user page.
export async function listUserOrders(userId: number, limit = 5) {
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: { id: true, orderNumber: true, createdAt: true, status: true, total: true, items: { select: { courseTitle: true } } },
    }),
    db.order.count({ where: { userId } }),
  ]);
  return {
    total,
    rows: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      status: o.status,
      total: Number(o.total),
      courses: o.items.map((i) => i.courseTitle),
    })),
  };
}

const num = (value: { toString(): string }) => Number(value);

// One order with everything the detail page shows, or null.
export async function getAdminOrder(id: number) {
  const order = await getOrderById(id);
  if (!order) return null;

  const enrolmentIds = order.items.map((i) => i.enrolmentId).filter((n): n is number => n !== null);
  const [enrolments, otherOrders, coupon] = await Promise.all([
    enrolmentIds.length
      ? db.enrolment.findMany({ where: { id: { in: enrolmentIds } }, select: { id: true, status: true, progressPercent: true, source: true } })
      : [],
    db.order.count({ where: { userId: order.userId, id: { not: order.id } } }),
    order.couponId ? db.coupon.findUnique({ where: { id: order.couponId }, select: { id: true } }) : null,
  ]);
  const enrolmentById = new Map(enrolments.map((e) => [e.id, e]));
  const itemTitles = new Map(order.items.map((i) => [i.id, i.courseTitle]));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    expiresAt: order.expiresAt,
    currency: order.currency,
    subtotal: num(order.subtotal),
    discountTotal: num(order.discountTotal),
    total: num(order.total),
    refundedTotal: num(order.refundedTotal),
    couponCode: order.couponCode,
    // Null when the coupon was deleted since.
    couponId: coupon?.id ?? null,
    learner: order.user,
    otherOrders,
    email: order.email,
    billing: {
      customerType: order.customerType,
      name: `${order.billingFirstName} ${order.billingLastName}`,
      company: order.billingCompany,
      line1: order.billingAddressLine1,
      line2: order.billingAddressLine2,
      city: order.billingCity,
      postcode: order.billingPostcode,
      country: order.billingCountry,
      phone: order.billingPhone,
    },
    items: order.items.map((i) => {
      const enrolment = i.enrolmentId ? enrolmentById.get(i.enrolmentId) : undefined;
      return {
        id: i.id,
        courseId: i.courseId,
        courseTitle: i.courseTitle,
        unitPrice: num(i.unitPrice),
        discount: num(i.discount),
        total: num(i.total),
        refundedAt: i.refundedAt,
        enrolment: enrolment ? { status: enrolment.status, progressPercent: enrolment.progressPercent, source: enrolment.source } : null,
      };
    }),
    payments: order.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amount: num(p.amount),
      cardBrand: p.cardBrand,
      cardLast4: p.cardLast4,
      stripeCheckoutSessionId: p.stripeCheckoutSessionId,
      stripePaymentIntentId: p.stripePaymentIntentId,
      stripeChargeId: p.stripeChargeId,
      receiptUrl: p.receiptUrl,
      failureMessage: p.failureMessage,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
    refunds: order.refunds.map((r) => ({
      id: r.id,
      amount: num(r.amount),
      status: r.status,
      reason: r.reason,
      failureMessage: r.failureMessage,
      stripeRefundId: r.stripeRefundId,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
      courses: r.items.map((ri) => itemTitles.get(ri.orderItemId) ?? "A course"),
      itemIds: r.items.map((ri) => ri.orderItemId),
    })),
    events: order.events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt, actor: e.actor })),
  };
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

// ---------------------------------------------------------------- changes

type Failure = { ok: false; error: string };

export async function addOrderNote(actor: { id: number }, orderId: number, note: string): Promise<{ ok: true; orderNumber: string } | Failure> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true } });
  if (!order) return { ok: false, error: "This order no longer exists." };
  await addOrderEvent(order.id, { type: "NOTE", message: note, actorId: actor.id });
  await logActivity({ userId: actor.id, action: "order.note", entity: "order", entityId: order.id, details: { orderNumber: order.orderNumber } });
  return { ok: true, orderNumber: order.orderNumber };
}

// Cancels a pending order through the safe path (payment.ts): its Stripe page
// is closed so nobody can pay for it later, the coupon use is given back, and
// an order the buyer has just paid is refused (and marked paid) instead.
export async function cancelPendingOrder(
  actor: { id: number; name: string },
  orderId: number,
): Promise<{ ok: true; orderNumber: string } | Failure> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
  if (!order) return { ok: false, error: "This order no longer exists." };

  const result = await cancelPendingOrderSafely(orderId, { reason: "cancelled", actorId: actor.id, message: `Cancelled by ${actor.name}.` });
  if (result.ok) return { ok: true, orderNumber: order.orderNumber };
  return {
    ok: false,
    error: isPaidStatus(result.status)
      ? "This order has been paid, so it cannot be cancelled. Refunds are handled separately."
      : result.status === "PENDING"
        ? "The learner's payment is still being confirmed, so the order cannot be cancelled yet."
        : "Only a pending order can be cancelled.",
  };
}
