import "server-only";
import type Stripe from "stripe";
import type { Prisma } from "@/generated/prisma/client";
import { formatPence, planRefund, toPence, toPounds } from "@/lib/commerce";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logActivity } from "@/services/activity";
import { addOrderEvent } from "@/services/order";

// Refunds: a whole order or chosen course lines, by an admin with order.refund.
//
// Order of work, so money and access never drift apart:
//   1. Locked transaction: plan the refund, store it PENDING with its lines and
//      a REFUND_REQUESTED event. A PENDING refund holds its lines: another
//      request for the same line is refused while it exists (the order row
//      lock makes two simultaneous requests run one after the other, and the
//      second sees the first's PENDING rows).
//   2. Stripe, outside any transaction, with an idempotency key made from the
//      refund id, so a repeated call cannot refund twice.
//   3. Locked transaction: mark SUCCEEDED, stamp the lines, update the order's
//      refunded total and status, end the access the order gave, write the
//      REFUNDED event. settleRefund is idempotent, so the webhook may repeat it.
// If Stripe refuses, the refund becomes FAILED and nothing else changes.

type Tx = Prisma.TransactionClient;

const lockOrder = (tx: Tx, orderId: number) => tx.$queryRaw`SELECT id FROM \`order\` WHERE id = ${orderId} FOR UPDATE`;

const planMessages = {
  not_refundable: "This order cannot be refunded in its current status.",
  nothing_selected: "Choose at least one course to refund. Every course on this order is already refunded.",
  unknown_item: "One of the chosen courses is not on this order.",
  already_refunded: "One of the chosen courses has already been refunded.",
} as const;

const IN_PROGRESS = "A refund for one of these courses is already in progress. Wait for it to finish or fail.";

const money = (pounds: number | { toString(): string }) => formatPence(toPence(Number(pounds)));
const sentence = (names: string[]) => names.join(", ");

export type RefundResult =
  | {
      ok: true;
      orderNumber: string;
      amountPence: number;
      // PENDING: Stripe accepted it but has not settled it; the site finishes when Stripe says so.
      status: "SUCCEEDED" | "PENDING";
    }
  | { ok: false; error: string };

// ---------------------------------------------------------------- requesting

export async function requestRefund(
  actor: { id: number; name: string },
  input: { orderId: number; itemIds: number[] | null; reason: string | null },
): Promise<RefundResult> {
  const started = await db.$transaction(async (tx) => {
    await lockOrder(tx, input.orderId);
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        refundedTotal: true,
        stripePaymentIntentId: true,
        items: { orderBy: { id: "asc" }, select: { id: true, courseTitle: true, total: true, refundedAt: true } },
        payments: { where: { status: "SUCCEEDED" }, orderBy: { id: "asc" }, select: { id: true, provider: true, stripePaymentIntentId: true } },
      },
    });
    if (!order) return { ok: false as const, error: "This order no longer exists." };

    const held = await tx.refundItem.findMany({
      where: { orderItemId: { in: order.items.map((i) => i.id) }, refund: { status: "PENDING" } },
      select: { orderItemId: true },
    });
    const heldIds = new Set(held.map((h) => h.orderItemId));
    if (input.itemIds?.some((id) => heldIds.has(id))) return { ok: false as const, error: IN_PROGRESS };

    // A line held by a refund in progress counts as taken, so a whole-order request skips it.
    const plan = planRefund({
      status: order.status,
      items: order.items.map((i) => ({ id: i.id, totalPence: toPence(Number(i.total)), refunded: i.refundedAt !== null || heldIds.has(i.id) })),
      refundedTotalPence: toPence(Number(order.refundedTotal)),
      itemIds: input.itemIds,
    });
    if (!plan.ok) return { ok: false as const, error: planMessages[plan.reason] };

    // The payment that paid the order (the one holding its payment intent when there are two).
    const payment = order.payments.find((p) => p.stripePaymentIntentId && p.stripePaymentIntentId === order.stripePaymentIntentId) ?? order.payments[0];
    if (!payment) return { ok: false as const, error: "This order has no successful payment to refund." };
    const free = payment.provider === "FREE" || plan.amountPence === 0;
    const intentId = payment.stripePaymentIntentId ?? order.stripePaymentIntentId;
    if (!free && !intentId) return { ok: false as const, error: "This payment has no Stripe payment on record, so it cannot be refunded from here." };
    if (!free && !isStripeConfigured()) return { ok: false as const, error: "Payments are not set up, so a refund cannot be sent to Stripe." };

    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        amount: toPounds(plan.amountPence),
        reason: input.reason,
        createdById: actor.id,
        items: { create: plan.itemIds.map((orderItemId, i) => ({ orderItemId, amount: toPounds(plan.itemAmountsPence[i]) })) },
      },
      select: { id: true },
    });
    const titles = order.items.filter((i) => plan.itemIds.includes(i.id)).map((i) => i.courseTitle);
    await addOrderEvent(
      order.id,
      {
        type: "REFUND_REQUESTED",
        message: `Refund of ${formatPence(plan.amountPence)} requested by ${actor.name} for ${sentence(titles)}.${input.reason ? ` Reason: ${input.reason}` : ""}`,
        actorId: actor.id,
        data: { refundId: refund.id, itemIds: plan.itemIds },
      },
      tx,
    );
    return { ok: true as const, refundId: refund.id, orderId: order.id, orderNumber: order.orderNumber, amountPence: plan.amountPence, free, intentId };
  });
  if (!started.ok) return started;

  const { refundId, orderNumber, amountPence } = started;
  await logActivity({
    userId: actor.id,
    action: "order.refund-request",
    entity: "order",
    entityId: started.orderId,
    details: { orderNumber, refundId, amountPence },
  });

  if (started.free) {
    await settleRefund(refundId, null);
    return { ok: true, orderNumber, amountPence, status: "SUCCEEDED" };
  }

  let stripeRefund: Stripe.Refund;
  try {
    stripeRefund = await getStripe().refunds.create(
      {
        payment_intent: started.intentId!,
        amount: amountPence,
        reason: "requested_by_customer",
        metadata: { refundId: String(refundId), orderId: String(started.orderId), orderNumber },
      },
      { idempotencyKey: `refund-${refundId}` },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe refused the refund.";
    console.error("Stripe refund failed", message);
    await failRefund(refundId, message);
    return { ok: false, error: `Stripe could not make the refund: ${message}` };
  }

  if (stripeRefund.status === "succeeded") {
    await settleRefund(refundId, stripeRefund.id);
    return { ok: true, orderNumber, amountPence, status: "SUCCEEDED" };
  }
  if (stripeRefund.status === "failed" || stripeRefund.status === "canceled") {
    const message = stripeRefund.failure_reason ? `Stripe could not complete the refund (${stripeRefund.failure_reason}).` : "Stripe could not complete the refund.";
    await failRefund(refundId, message);
    return { ok: false, error: message };
  }
  // Pending or needs action: keep the id so the webhook can find it, and wait.
  await db.refund.updateMany({ where: { id: refundId, status: "PENDING", stripeRefundId: null }, data: { stripeRefundId: stripeRefund.id } });
  return { ok: true, orderNumber, amountPence, status: "PENDING" };
}

// ---------------------------------------------------------------- settling

export type SettleResult = { changed: true } | { changed: false; was: "SUCCEEDED" | "FAILED" | "missing" };

// Applies a refund Stripe has made: the single place that stamps lines,
// changes the order and ends access. Idempotent. A refund recorded as FAILED
// is not applied (its lines may have been refunded again since): the caller
// is told, and staff are pointed at Stripe.
export async function settleRefund(refundId: number, stripeRefundId: string | null): Promise<SettleResult> {
  const first = await db.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
  if (!first) return { changed: false, was: "missing" };

  const done = await db.$transaction(async (tx) => {
    await lockOrder(tx, first.orderId);
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: {
        id: true,
        status: true,
        amount: true,
        createdById: true,
        items: { select: { orderItemId: true, amount: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            refundedTotal: true,
            items: {
              orderBy: { id: "asc" },
              select: { id: true, courseTitle: true, refundedAt: true, enrolment: { select: { id: true, status: true, source: true } } },
            },
          },
        },
      },
    });
    if (refund.status !== "PENDING") {
      if (refund.status === "SUCCEEDED" && stripeRefundId) {
        await tx.refund.updateMany({ where: { id: refundId, stripeRefundId: null }, data: { stripeRefundId } });
      }
      return { changed: false as const, was: refund.status };
    }

    const now = new Date();
    const order = refund.order;
    const chosen = new Set(refund.items.map((i) => i.orderItemId));
    await tx.refund.update({ where: { id: refundId }, data: { status: "SUCCEEDED", stripeRefundId, failureMessage: null } });
    await tx.orderItem.updateMany({ where: { id: { in: [...chosen] }, refundedAt: null }, data: { refundedAt: now } });

    const everyLineRefunded = order.items.every((i) => i.refundedAt !== null || chosen.has(i.id));
    await tx.order.update({
      where: { id: order.id },
      data: {
        refundedTotal: toPounds(toPence(Number(order.refundedTotal)) + toPence(Number(refund.amount))),
        status: everyLineRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    // End the access the order gave. An enrolment that existed before the order
    // (assigned or self-enrolled) is not the order's to take away.
    const removed: string[] = [];
    const kept: string[] = [];
    for (const item of order.items.filter((i) => chosen.has(i.id))) {
      const enrolment = item.enrolment;
      if (!enrolment || enrolment.status === "CANCELLED") continue;
      if (enrolment.source === "ORDER") {
        await tx.enrolment.update({ where: { id: enrolment.id }, data: { status: "CANCELLED" } });
        removed.push(item.courseTitle);
      } else {
        kept.push(item.courseTitle);
      }
    }
    const titles = order.items.filter((i) => chosen.has(i.id)).map((i) => i.courseTitle);
    await addOrderEvent(
      order.id,
      {
        type: "REFUNDED",
        message: [
          `Refunded ${money(refund.amount)} for ${sentence(titles)}.`,
          removed.length ? `Access removed: ${sentence(removed)}.` : null,
          kept.length ? `Access kept: ${sentence(kept)} (the learner was enrolled before this order, not through it).` : null,
          "Certificates are not revoked automatically.",
        ]
          .filter(Boolean)
          .join(" "),
        actorId: refund.createdById,
        data: { refundId, stripeRefundId, removed, kept },
      },
      tx,
    );
    return { changed: true as const, orderId: order.id, orderNumber: order.orderNumber, actorId: refund.createdById, amount: Number(refund.amount) };
  });

  if (!done.changed) return done;
  await logActivity({
    userId: done.actorId,
    action: "order.refund",
    entity: "order",
    entityId: done.orderId,
    details: { orderNumber: done.orderNumber, refundId, amountPence: toPence(done.amount) },
  });
  return { changed: true };
}

// Marks a PENDING refund FAILED and says so on the timeline; nothing else
// changes (the lines stay as they were and can be refunded again).
export async function failRefund(refundId: number, message: string) {
  const first = await db.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
  if (!first) return false;
  const done = await db.$transaction(async (tx) => {
    await lockOrder(tx, first.orderId);
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: { status: true, amount: true, createdById: true, order: { select: { id: true, orderNumber: true } } },
    });
    if (refund.status !== "PENDING") return null;
    await tx.refund.update({ where: { id: refundId }, data: { status: "FAILED", failureMessage: message } });
    await addOrderEvent(
      refund.order.id,
      { type: "NOTE", message: `Refund of ${money(refund.amount)} failed: ${message} Nothing was changed: the learner keeps access and the courses can be refunded again.`, data: { refundId, refundFailed: true } },
      tx,
    );
    return { orderId: refund.order.id, orderNumber: refund.order.orderNumber, actorId: refund.createdById, amount: Number(refund.amount) };
  });
  if (!done) return false;
  await logActivity({
    userId: done.actorId,
    action: "order.refund-fail",
    entity: "order",
    entityId: done.orderId,
    details: { orderNumber: done.orderNumber, refundId, amountPence: toPence(done.amount), message },
  });
  return true;
}

// A refund the site recorded as SUCCEEDED that Stripe now reports as failed or
// cancelled (money did not go back). Marks it FAILED and takes it out of the
// order's refunded total and the lines' refunded stamp, so the books match the
// bank, then flags it loudly. Access that was removed is NOT restored: staff
// decide (Enrolments, "Reactivate").
async function reverseRefund(refundId: number, message: string) {
  const first = await db.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
  if (!first) return;
  await db.$transaction(async (tx) => {
    await lockOrder(tx, first.orderId);
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: {
        status: true,
        amount: true,
        items: { select: { orderItemId: true } },
        order: { select: { id: true, refundedTotal: true, items: { select: { id: true, refundedAt: true } } } },
      },
    });
    if (refund.status !== "SUCCEEDED") return;
    const ids = new Set(refund.items.map((i) => i.orderItemId));
    await tx.refund.update({ where: { id: refundId }, data: { status: "FAILED", failureMessage: message } });
    await tx.orderItem.updateMany({ where: { id: { in: [...ids] } }, data: { refundedAt: null } });
    const stillRefunded = refund.order.items.some((i) => i.refundedAt !== null && !ids.has(i.id));
    await tx.order.update({
      where: { id: refund.order.id },
      data: {
        refundedTotal: toPounds(Math.max(toPence(Number(refund.order.refundedTotal)) - toPence(Number(refund.amount)), 0)),
        status: stillRefunded ? "PARTIALLY_REFUNDED" : "PAID",
      },
    });
    await addOrderEvent(
      refund.order.id,
      {
        type: "NOTE",
        message: `ATTENTION: Stripe reports that the refund of ${money(refund.amount)} did not go through (${message}). The money has NOT been returned, so the refund is marked failed and the order's refunded total was reduced. The learner's access was removed when the refund was recorded and has not been restored: reactivate it from Enrolments if they should keep it, then refund again or return the money in the Stripe dashboard.`,
        data: { refundId, refundFailed: true },
      },
      tx,
    );
  });
  const row = await db.refund.findUnique({ where: { id: refundId }, select: { orderId: true, createdById: true, amount: true, order: { select: { orderNumber: true } } } });
  if (row) {
    await logActivity({
      userId: row.createdById,
      action: "order.refund-fail",
      entity: "order",
      entityId: row.orderId,
      details: { orderNumber: row.order.orderNumber, refundId, amountPence: toPence(Number(row.amount)), message },
    });
  }
}

// ---------------------------------------------------------------- Stripe events

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

const failureText = (refund: Stripe.Refund) => (refund.failure_reason ? `Stripe reported: ${refund.failure_reason}.` : "Stripe reported the refund as failed.");

// Keeps a refund in step with what Stripe says (refund.created / updated / failed).
// A refund the site knows (by Stripe id, or by the metadata it sent) is updated;
// one made in the Stripe dashboard is recorded as a note and nothing else.
export async function applyStripeRefund(refund: Stripe.Refund) {
  const metaId = Number(refund.metadata?.refundId);
  const local = await db.refund.findFirst({
    where: { OR: [{ stripeRefundId: refund.id }, ...(Number.isInteger(metaId) && metaId > 0 ? [{ id: metaId, orderId: Number(refund.metadata?.orderId) || -1 }] : [])] },
    select: { id: true, status: true, orderId: true, stripeRefundId: true },
  });

  if (!local) {
    await noteUnknownRefund(refund);
    return;
  }

  const status = refund.status;
  if (status === "succeeded") {
    if (local.status === "FAILED") {
      await flagOnce(local.orderId, refund.id, `ATTENTION: Stripe reports refund ${refund.id} (${money(toPounds(refund.amount))}) as succeeded, but this site had recorded it as failed. The money has been returned, yet the courses are not marked refunded and access was not removed. Check the order and the learner's enrolments by hand.`);
      return;
    }
    await settleRefund(local.id, refund.id);
  } else if (status === "failed" || status === "canceled") {
    if (local.status === "PENDING") {
      await db.refund.updateMany({ where: { id: local.id, stripeRefundId: null }, data: { stripeRefundId: refund.id } });
      await failRefund(local.id, failureText(refund));
    } else if (local.status === "SUCCEEDED") {
      await reverseRefund(local.id, failureText(refund));
    }
  } else if (local.status === "PENDING" && !local.stripeRefundId) {
    await db.refund.updateMany({ where: { id: local.id, stripeRefundId: null }, data: { stripeRefundId: refund.id } });
  }
}

async function flagOnce(orderId: number, stripeRefundId: string, message: string) {
  const flag = `succeeded-after-failed:${stripeRefundId}`;
  const seen = await db.orderEvent.findFirst({ where: { orderId, type: "NOTE", data: { path: "$.flag", equals: flag } }, select: { id: true } });
  if (seen) return;
  await addOrderEvent(orderId, { type: "NOTE", message, data: { flag, stripeRefundId } });
}

async function noteUnknownRefund(refund: Stripe.Refund) {
  const intentId = idOf(refund.payment_intent);
  if (!intentId) return;
  const payment = await db.payment.findUnique({ where: { stripePaymentIntentId: intentId }, select: { orderId: true } });
  if (!payment) return;
  const seen = await db.orderEvent.findFirst({
    where: { orderId: payment.orderId, type: "NOTE", data: { path: "$.stripeRefundId", equals: refund.id } },
    select: { id: true },
  });
  if (seen) return;
  await addOrderEvent(payment.orderId, {
    type: "NOTE",
    message: `A refund of ${money(toPounds(refund.amount))} (${refund.status ?? "unknown status"}, ${refund.id}) was made in the Stripe dashboard, not from this site. It is not tied to any course, so the order's status, refunded total and the learner's access are unchanged. Remove access from Enrolments if it applies.`,
    data: { stripeRefundId: refund.id, external: true },
  });
}
