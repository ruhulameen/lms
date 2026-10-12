import "server-only";
import type Stripe from "stripe";
import type { Prisma } from "@/generated/prisma/client";
import {
  CURRENCY,
  canTransition,
  checkoutSessionExpiry,
  classifyCheckoutSession,
  formatPence,
  isOrderExpired,
  isPaidStatus,
  toPence,
  toPounds,
  type CheckoutSessionOutcome,
  type OrderStatusValue,
} from "@/lib/commerce";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logActivity } from "@/services/activity";
import { releaseCouponUse, reserveCouponUse } from "@/services/coupon";
import { addOrderEvent, fulfilOrder } from "@/services/order";

// Paying for an order and keeping the order in step with what Stripe says.
//
// The order is marked paid only from Stripe-verified information, through one
// function: applyCheckoutSession. It is fed by the webhook (signature
// checked) and by syncOrderWithStripe, which retrieves the Checkout Session
// from Stripe's API (the return page, opening a pending order, pay again), so
// a missed webhook heals and local development works without forwarding.
// Everything here is idempotent: the order row is locked for each change and
// the status is re-read under the lock.
//
// Also here: ending an order that will not be paid (cancelPendingOrder,
// expireOrderIfDue) and sweepExpiredOrders for a scheduled job.

type Tx = Prisma.TransactionClient;

const lockOrder = (tx: Tx, orderId: number) => tx.$queryRaw`SELECT id FROM \`order\` WHERE id = ${orderId} FOR UPDATE`;

const siteOrigin = () => new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;

export const orderPagePath = (orderNumber: string) => `/checkout/order/${orderNumber}`;

// ---------------------------------------------------------------- starting a payment

const payableOrderSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  status: true,
  total: true,
  email: true,
  expiresAt: true,
  items: { orderBy: { id: "asc" }, select: { courseTitle: true, total: true } },
  payments: { where: { provider: "STRIPE" }, orderBy: { id: "asc" }, select: { id: true, status: true, stripeCheckoutSessionId: true } },
} satisfies Prisma.OrderSelect;

export type StartPaymentResult =
  | { ok: true; url: string }
  // The order is no longer payable; `status` is where it ended up.
  | { ok: false; error: string; status: OrderStatusValue };

// Sends the buyer to Stripe's hosted page for a pending order: reuses the
// session of an earlier attempt that is still open, otherwise creates a new
// one with its own Payment row. Concurrent calls for the same attempt get the
// same session (Stripe idempotency key per attempt number) and the second
// Payment insert, which would repeat the session id, is ignored.
export async function startStripePayment(orderId: number): Promise<StartPaymentResult> {
  if (!isStripeConfigured()) return { ok: false, error: "Payments are not set up yet.", status: "PENDING" };

  // An order past its time is closed, not paid.
  if (await expireOrderIfDue(orderId)) {
    return { ok: false, error: "This order has expired. Add the courses to your cart again.", status: "CANCELLED" };
  }

  // Settle earlier attempts first: one may have been paid, or still be open.
  const synced = await syncOrderWithStripe(orderId);
  if (synced.status !== "PENDING") {
    return { ok: false, error: "This order can no longer be paid.", status: synced.status };
  }
  if (synced.openUrl) return { ok: true, url: synced.openUrl };

  const order = await db.order.findUnique({ where: { id: orderId }, select: payableOrderSelect });
  if (!order) return { ok: false, error: "Order not found.", status: "CANCELLED" };
  const now = new Date();
  if (order.status !== "PENDING" || isOrderExpired(order, now)) {
    return { ok: false, error: "This order can no longer be paid.", status: order.status };
  }
  const totalPence = toPence(Number(order.total));
  if (totalPence <= 0) return { ok: false, error: "Nothing to pay for this order.", status: order.status };

  const origin = siteOrigin();
  const path = orderPagePath(order.orderNumber);
  const lineItems = order.items.map((item) => ({
    quantity: 1,
    price_data: {
      currency: CURRENCY.toLowerCase(),
      unit_amount: toPence(Number(item.total)),
      product_data: { name: item.courseTitle },
    },
  }));

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        client_reference_id: order.orderNumber,
        customer_email: order.email,
        metadata: { orderId: String(order.id), orderNumber: order.orderNumber },
        payment_intent_data: {
          description: `Order ${order.orderNumber}`,
          metadata: { orderId: String(order.id), orderNumber: order.orderNumber },
        },
        success_url: `${origin}${path}?paid=1`,
        cancel_url: `${origin}${path}?cancelled=1`,
        expires_at: checkoutSessionExpiry(order.expiresAt, now),
      },
      { idempotencyKey: `checkout-${order.orderNumber}-attempt-${order.payments.length + 1}` },
    );
  } catch (error) {
    console.error("Could not create a Stripe Checkout Session", error instanceof Error ? error.message : error);
    return { ok: false, error: "We could not reach the payment provider. Please try again in a moment.", status: "PENDING" };
  }
  if (!session.url) return { ok: false, error: "The payment provider did not return a payment page.", status: "PENDING" };

  try {
    await db.$transaction(async (tx) => {
      await lockOrder(tx, order.id);
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "STRIPE",
          amount: toPounds(totalPence),
          currency: CURRENCY,
          stripeCheckoutSessionId: session.id,
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
      await addOrderEvent(
        order.id,
        { type: "PAYMENT_STARTED", message: `Payment started for ${formatPence(totalPence)} with Stripe.`, data: { sessionId: session.id } },
        tx,
      );
    });
  } catch (error) {
    // Same session already recorded by a concurrent request: carry on with it.
    if (!(error instanceof Error && "code" in error && error.code === "P2002")) throw error;
  }
  return { ok: true, url: session.url };
}

// ---------------------------------------------------------------- reading from Stripe

export type SyncResult = {
  status: OrderStatusValue;
  // A delayed payment method has been submitted and the money has not arrived.
  processing: boolean;
  // A session the buyer can still pay on.
  openUrl: string | null;
};

// Retrieves every unsettled Stripe session of the order from Stripe and
// applies what they say. Safe to call at any time; does nothing without a key.
export async function syncOrderWithStripe(orderId: number): Promise<SyncResult> {
  const payments = await db.payment.findMany({
    where: { orderId, provider: "STRIPE", status: "PENDING", stripeCheckoutSessionId: { not: null } },
    orderBy: { id: "desc" },
    select: { stripeCheckoutSessionId: true },
  });
  let processing = false;
  let openUrl: string | null = null;

  if (isStripeConfigured()) {
    for (const payment of payments) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(payment.stripeCheckoutSessionId!, {
          expand: ["payment_intent.latest_charge"],
        });
        const result = await applyCheckoutSession(session, { enrich: false });
        if (!result.handled) continue;
        if (result.outcome === "processing") processing = true;
        if (result.outcome === "open" && session.url && !openUrl) openUrl = session.url;
      } catch (error) {
        console.error("Could not read a Stripe Checkout Session", error instanceof Error ? error.message : error);
      }
    }
  }
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, expiresAt: true } });
  const status = order?.status ?? "CANCELLED";
  // Only a PENDING order is payable; a stale open session on an ended order is not offered.
  return { status, processing: status === "PENDING" && processing, openUrl: status === "PENDING" ? openUrl : null };
}

// ---------------------------------------------------------------- applying a session

export type ApplyResult =
  | { handled: false; reason: "unknown_session" | "metadata_mismatch" }
  | { handled: true; outcome: CheckoutSessionOutcome["kind"]; orderId: number };

const idOf = <T extends { id: string }>(value: string | T | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

// The single place a Stripe Checkout Session changes an order. `hint` is for
// events whose type says more than the session does (async payment failed).
// `enrich` fetches the card details when the session was not expanded.
export async function applyCheckoutSession(
  session: Stripe.Checkout.Session,
  options: { hint?: "async_failed"; enrich?: boolean } = {},
): Promise<ApplyResult> {
  const payment = await db.payment.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    select: { id: true, orderId: true, order: { select: { id: true, status: true, total: true } } },
  });
  if (!payment) return { handled: false, reason: "unknown_session" };
  const claimed = session.metadata?.orderId;
  if (claimed && claimed !== String(payment.orderId)) return { handled: false, reason: "metadata_mismatch" };

  const expectedPence = toPence(Number(payment.order.total));
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const outcome = classifyCheckoutSession(
    {
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
      paymentIntentStatus: intent?.status ?? null,
    },
    { totalPence: expectedPence },
    options.hint,
  );

  switch (outcome.kind) {
    case "paid":
      await markPaid(payment.id, payment.orderId, session, options.enrich !== false);
      break;
    case "mismatch":
      await recordProblem(payment.id, payment.orderId, outcome.message);
      break;
    case "failed":
      await markAttemptFailed(payment.id, payment.orderId, outcome.message);
      break;
    case "expired":
      await markAttemptExpired(payment.id, payment.orderId);
      break;
    default:
      break;
  }
  return { handled: true, outcome: outcome.kind, orderId: payment.orderId };
}

type ChargeDetails = { chargeId: string | null; brand: string | null; last4: string | null; receiptUrl: string | null; intentId: string | null };

async function chargeDetails(session: Stripe.Checkout.Session, enrich: boolean): Promise<ChargeDetails> {
  let intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const intentId = idOf(session.payment_intent);
  let charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  if (!charge && enrich && intentId && isStripeConfigured()) {
    try {
      intent = await getStripe().paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
      charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    } catch (error) {
      console.error("Could not read the card details from Stripe", error instanceof Error ? error.message : error);
    }
  }
  const card = charge?.payment_method_details?.card;
  return {
    chargeId: charge?.id ?? idOf(intent?.latest_charge),
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    receiptUrl: charge?.receipt_url ?? null,
    intentId,
  };
}

async function markPaid(paymentId: number, orderId: number, session: Stripe.Checkout.Session, enrich: boolean) {
  const details = await chargeDetails(session, enrich);
  const paidPence = session.amount_total ?? 0;

  const result = await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        couponId: true,
        items: { select: { courseId: true, unitPrice: true, course: { select: { categoryId: true } } } },
      },
    });
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true } });
    if (payment.status === "SUCCEEDED") return { changed: false as const };

    const otherPaid = await tx.payment.findFirst({
      where: { orderId, status: "SUCCEEDED", id: { not: paymentId } },
      select: { id: true },
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "SUCCEEDED",
        paidAt: new Date(),
        failureMessage: null,
        stripePaymentIntentId: details.intentId,
        stripeChargeId: details.chargeId,
        cardBrand: details.brand,
        cardLast4: details.last4,
        receiptUrl: details.receiptUrl,
      },
    });

    // A second successful payment for an order that is already paid (two
    // sessions both completed): kept on record for someone to refund.
    if (otherPaid || (isPaidStatus(order.status) && order.status !== "PAID")) {
      await addOrderEvent(
        orderId,
        {
          type: "NOTE",
          message: `A second payment of ${formatPence(paidPence)} (Stripe session ${session.id}) arrived for an order that is already paid. It needs to be refunded in Stripe.`,
          data: { sessionId: session.id, duplicate: true },
        },
        tx,
      );
      return { changed: false as const };
    }
    if (order.status === "PAID") return { changed: false as const };
    if (!canTransition(order.status, "PAID")) return { changed: false as const };

    const late = order.status !== "PENDING";
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        cancelledAt: null,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: details.intentId,
      },
    });
    await tx.payment.updateMany({
      where: { orderId, status: "PENDING", id: { not: paymentId } },
      data: { status: "CANCELLED" },
    });
    await addOrderEvent(
      orderId,
      {
        type: "PAID",
        message: late
          ? `Payment of ${formatPence(paidPence)} received after the order had been ${order.status.toLowerCase()}; the order is now paid.`
          : `Payment of ${formatPence(paidPence)} received.`,
        data: { sessionId: session.id, late },
      },
      tx,
    );

    if (late && order.couponId) {
      const taken = await reserveCouponUse(tx, {
        couponId: order.couponId,
        userId: order.userId,
        orderId,
        lines: order.items.map((i) => ({
          courseId: i.courseId,
          categoryId: i.course.categoryId,
          pricePence: toPence(Number(i.unitPrice)),
        })),
      });
      await addOrderEvent(
        orderId,
        {
          type: "NOTE",
          message: taken.ok
            ? "The coupon use was counted again for this late payment."
            : `The coupon could not be counted again for this late payment: ${taken.message}`,
        },
        tx,
      );
    }
    return { changed: true as const, orderNumber: order.orderNumber, userId: order.userId };
  });

  // Idempotent, so also safe when the order was marked paid by an earlier call that stopped short.
  await fulfilOrder(orderId);
  if (result.changed) {
    await logActivity({
      userId: result.userId,
      action: "order.paid",
      entity: "order",
      entityId: orderId,
      details: { orderNumber: result.orderNumber, totalPence: paidPence },
    });
    await sendOrderConfirmedEmail(orderId);
  }
}

// Stripe reported a payment that does not match the order: written once on the
// attempt and the timeline, the order stays as it was.
async function recordProblem(paymentId: number, orderId: number, message: string) {
  await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { failureMessage: true } });
    if (payment.failureMessage === message) return;
    await tx.payment.update({ where: { id: paymentId }, data: { failureMessage: message } });
    await addOrderEvent(orderId, { type: "NOTE", message: `Payment not accepted: ${message} The order was not marked paid.` }, tx);
  });
}

async function markAttemptFailed(paymentId: number, orderId: number, message: string) {
  const ended = await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { status: true } });
    if (payment.status !== "PENDING") return null;
    await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureMessage: message } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, userId: true, orderNumber: true } });
    if (order.status !== "PENDING") return null;
    // Another attempt may still be open: the order stays payable.
    const alive = await tx.payment.count({ where: { orderId, status: "PENDING" } });
    if (alive > 0) return null;
    await endOrder(tx, orderId, "FAILED", { type: "FAILED", message: `Payment failed: ${message}` });
    return { userId: order.userId, orderNumber: order.orderNumber };
  });
  if (ended) {
    await logActivity({ userId: ended.userId, action: "order.fail", entity: "order", entityId: orderId, details: { orderNumber: ended.orderNumber } });
  }
}

async function markAttemptExpired(paymentId: number, orderId: number) {
  await db.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "CANCELLED" } });
  // The Stripe page lapsing does not end the order unless the order is due too.
  await expireOrderIfDue(orderId);
}

// Moves an order out of PENDING and gives the coupon use back. Inside the
// caller's transaction, with the order row locked.
async function endOrder(
  tx: Tx,
  orderId: number,
  status: "FAILED" | "CANCELLED",
  event: { type: "FAILED" | "CANCELLED" | "EXPIRED"; message: string; actorId?: number | null },
) {
  await tx.order.update({ where: { id: orderId }, data: { status, cancelledAt: status === "CANCELLED" ? new Date() : null } });
  await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: status === "FAILED" ? "FAILED" : "CANCELLED" } });
  await addOrderEvent(orderId, event, tx);
  if (await releaseCouponUse(orderId, tx)) {
    await addOrderEvent(orderId, { type: "COUPON_RELEASED", message: "The coupon use was given back." }, tx);
  }
}

// ---------------------------------------------------------------- ending unpaid orders

export type CancelReason = "expired" | "cancelled" | "superseded";

export type CancelResult =
  | { ok: true }
  // Not cancelled: the order is not pending any more (it may have just been paid).
  | { ok: false; status: OrderStatusValue };

const cancelMessages: Record<CancelReason, string> = {
  expired: "The order expired before it was paid.",
  cancelled: "The order was cancelled.",
  superseded: "Replaced by a newer order for a different cart.",
};

// Cancels a PENDING order: closes its Stripe page(s) so nobody can pay for it
// later, marks the attempts and the order, and gives the coupon use back. The
// safe way to cancel from anywhere, admin included: if Stripe says the buyer
// has paid in the meantime the order is marked paid instead and `ok: false`
// comes back. Idempotent.
export async function cancelPendingOrder(
  orderId: number,
  options: { reason: CancelReason; actorId?: number | null; message?: string },
): Promise<CancelResult> {
  const first = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!first) return { ok: false, status: "CANCELLED" };
  if (first.status !== "PENDING") return { ok: false, status: first.status };

  let processing = false;
  if (isStripeConfigured()) {
    const attempts = await db.payment.findMany({
      where: { orderId, provider: "STRIPE", status: "PENDING", stripeCheckoutSessionId: { not: null } },
      select: { stripeCheckoutSessionId: true },
    });
    for (const attempt of attempts) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(attempt.stripeCheckoutSessionId!, {
          expand: ["payment_intent.latest_charge"],
        });
        if (session.status === "complete") {
          const applied = await applyCheckoutSession(session, { enrich: false });
          if (applied.handled && applied.outcome === "processing") processing = true;
        } else if (session.status === "open") {
          await getStripe().checkout.sessions.expire(session.id);
        }
      } catch (error) {
        console.error("Could not close a Stripe Checkout Session", error instanceof Error ? error.message : error);
      }
    }
  }

  // A payment still being confirmed (delayed method) must not be cancelled under the buyer.
  if (processing) return { ok: false, status: "PENDING" };

  const ended = await db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, userId: true, orderNumber: true } });
    if (order.status !== "PENDING") return { ok: false as const, status: order.status };
    await endOrder(tx, orderId, "CANCELLED", {
      type: options.reason === "expired" ? "EXPIRED" : "CANCELLED",
      message: options.message ?? cancelMessages[options.reason],
      actorId: options.actorId ?? null,
    });
    return { ok: true as const, userId: order.userId, orderNumber: order.orderNumber };
  });
  if (!ended.ok) return ended;
  await logActivity({
    userId: options.actorId ?? ended.userId,
    action: "order.cancel",
    entity: "order",
    entityId: orderId,
    details: { orderNumber: ended.orderNumber, reason: options.reason },
  });
  return { ok: true };
}

// Cancels the order when it is pending and past its expiry. Returns whether it did.
export async function expireOrderIfDue(orderId: number, now = new Date()): Promise<boolean> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, expiresAt: true } });
  if (!order || !isOrderExpired(order, now)) return false;
  const result = await cancelPendingOrder(orderId, { reason: "expired" });
  return result.ok;
}

// Cancels every pending order past its expiry. There is no scheduler yet:
// expiry otherwise happens lazily when an order is opened or paid. A future
// scheduled job (cron route, queue worker) should call this every few minutes.
// Returns how many orders it cancelled.
export async function sweepExpiredOrders(limit = 200, now = new Date()): Promise<number> {
  const due = await db.order.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let cancelled = 0;
  for (const { id } of due) {
    if (await expireOrderIfDue(id, now)) cancelled += 1;
  }
  return cancelled;
}

// ---------------------------------------------------------------- free orders

// Completes an order whose total is 0 (a 100% coupon): a FREE payment, the
// order paid, on the caller's transaction (the order row exists, is PENDING
// and is not yet visible to anyone else).
export async function markFreeOrderPaid(tx: Tx, orderId: number) {
  await tx.payment.create({
    data: { orderId, provider: "FREE", status: "SUCCEEDED", amount: 0, currency: CURRENCY, paidAt: new Date() },
  });
  await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: new Date() } });
  await addOrderEvent(orderId, { type: "PAID", message: "The order total was £0, so no payment was needed." }, tx);
}

// ---------------------------------------------------------------- email

export async function sendOrderConfirmedEmail(orderId: number) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      email: true,
      total: true,
      billingFirstName: true,
      items: { orderBy: { id: "asc" }, select: { courseTitle: true, total: true } },
    },
  });
  if (!order) return;
  const lines = order.items.map((i) => `  - ${i.courseTitle}: ${formatPence(toPence(Number(i.total)))}`).join("\n");
  await sendEmail({
    to: order.email,
    subject: `Order ${order.orderNumber} confirmed`,
    text: `Hi ${order.billingFirstName},\n\nThank you for your order ${order.orderNumber}.\n\n${lines}\n\nTotal: ${formatPence(toPence(Number(order.total)))}\n\nYour courses are ready in My Courses.`,
  });
}
