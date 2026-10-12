import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { BillingDetails, BillingFormValues } from "@/lib/checkout";
import {
  CURRENCY,
  generateOrderNumber,
  isFreeOrder,
  isOrderExpired,
  orderExpiryDate,
  orderSignature,
  toPence,
  toPounds,
} from "@/lib/commerce";
import { publiclyVisibleWhere } from "@/lib/content-status";
import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import { logActivity } from "@/services/activity";
import { getPricedCart } from "@/services/cart";
import { evaluateCoupon, reserveCouponUse } from "@/services/coupon";
import { addOrderEvent, fulfilOrder } from "@/services/order";
import { cancelPendingOrder, markFreeOrderPaid, sendOrderConfirmedEmail, startStripePayment } from "@/services/payment";
import type { CurrentUser } from "@/services/user";

// Placing an order from the cart.

export type PlaceOrderResult =
  | { ok: true; kind: "free"; orderNumber: string }
  | { ok: true; kind: "pay"; orderNumber: string; url: string }
  // `dropCoupon`: the coupon in the cart no longer works and should be forgotten.
  | { ok: false; error: string; dropCoupon?: boolean; orderNumber?: string };

class Refusal extends Error {}

// What the billing form starts with: the learner's last order, else their account.
export async function getBillingDefaults(user: { id: number; name: string }): Promise<BillingFormValues> {
  const last = await db.order.findFirst({
    where: { userId: user.id },
    orderBy: { id: "desc" },
    select: {
      customerType: true,
      billingFirstName: true,
      billingLastName: true,
      billingCompany: true,
      billingAddressLine1: true,
      billingAddressLine2: true,
      billingCity: true,
      billingPostcode: true,
      billingCountry: true,
      billingPhone: true,
    },
  });
  if (last) {
    return {
      customerType: last.customerType,
      firstName: last.billingFirstName,
      lastName: last.billingLastName,
      company: last.billingCompany ?? "",
      addressLine1: last.billingAddressLine1,
      addressLine2: last.billingAddressLine2 ?? "",
      city: last.billingCity ?? "",
      postcode: last.billingPostcode,
      country: last.billingCountry,
      phone: last.billingPhone ?? "",
    };
  }
  const [firstName, ...rest] = user.name.trim().split(/\s+/);
  return {
    customerType: "INDIVIDUAL",
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    company: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: "GB",
    phone: "",
  };
}

const billingColumns = (billing: BillingDetails) => ({
  customerType: billing.customerType,
  billingFirstName: billing.firstName,
  billingLastName: billing.lastName,
  billingCompany: billing.customerType === "BUSINESS" ? billing.company : null,
  billingAddressLine1: billing.addressLine1,
  billingAddressLine2: billing.addressLine2,
  billingCity: billing.city,
  billingPostcode: billing.postcode,
  billingCountry: billing.country,
  billingPhone: billing.phone,
});

const isOrderNumberClash = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  String((error.meta as { target?: unknown } | undefined)?.target ?? "").includes("orderNumber");

// Creates the order for the signed-in learner's cart, then either completes it
// (total 0) or hands back Stripe's payment page.
//
// Prices are never taken from the browser: the cart is read and priced here
// from the database and the coupon is evaluated again, and inside the
// transaction the course prices are compared once more with what was priced.
//
// Double submit and concurrency: the learner's row is locked for the
// transaction, so two submits run one after the other. The second finds the
// first's still-open pending order for the identical cart (same courses,
// coupon and total, not expired), refreshes its billing details and reuses
// it; startStripePayment then returns the Stripe page that is already open.
// Pending orders for a different cart are cancelled first so their coupon use
// is given back.
export async function placeOrder(user: CurrentUser, billing: BillingDetails): Promise<PlaceOrderResult> {
  const cart = await getPricedCart();
  if (cart.items.length === 0) return { ok: false, error: "Your cart is empty." };

  // Re-evaluated here, not trusted from the page the form came from.
  const coupon = cart.couponCode ? await evaluateCoupon(user, cart.lines, cart.couponCode, { ignoreOwnPending: true }) : null;
  if (coupon && !coupon.ok) {
    return { ok: false, error: `${coupon.message} The coupon has been removed; check the total and try again.`, dropCoupon: true };
  }
  const pricing = coupon?.ok ? coupon.pricing : cart.pricing;
  const couponId = coupon?.ok ? coupon.couponId : null;
  const couponCode = coupon?.ok ? coupon.code : null;
  const free = isFreeOrder(pricing.totalPence);
  if (!free && !isStripeConfigured()) return { ok: false, error: "Payments are not set up yet." };

  const signature = orderSignature({
    courseIds: cart.lines.map((l) => l.courseId),
    couponCode,
    totalPence: pricing.totalPence,
  });
  const signatureOf = (order: { items: { courseId: number }[]; couponCode: string | null; total: Prisma.Decimal }) =>
    orderSignature({ courseIds: order.items.map((i) => i.courseId), couponCode: order.couponCode, totalPence: toPence(Number(order.total)) });

  // Open orders for another cart (or past their time) go first.
  const open = await db.order.findMany({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true, couponCode: true, total: true, expiresAt: true, status: true, items: { select: { courseId: true } } },
  });
  const now = new Date();
  for (const order of open) {
    const same = signatureOf(order) === signature && !isOrderExpired(order, now);
    if (!same) await cancelPendingOrder(order.id, { reason: isOrderExpired(order, now) ? "expired" : "superseded" });
  }

  let created: { id: number; orderNumber: string; reused: boolean } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    try {
      created = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM \`user\` WHERE id = ${user.id} FOR UPDATE`;

        const same = await tx.order.findMany({
          where: { userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
          select: { id: true, orderNumber: true, couponCode: true, total: true, items: { select: { courseId: true } } },
        });
        const reusable = same.find((order) => signatureOf(order) === signature);
        if (reusable) {
          await tx.order.update({ where: { id: reusable.id }, data: billingColumns(billing) });
          return { id: reusable.id, orderNumber: reusable.orderNumber, reused: true };
        }

        // Prices as they are right now, inside the transaction.
        const rows = await tx.course.findMany({
          where: { id: { in: cart.lines.map((l) => l.courseId) }, ...publiclyVisibleWhere() },
          select: { id: true, price: true },
        });
        const current = new Map(rows.map((r) => [r.id, r]));
        for (const line of cart.lines) {
          const row = current.get(line.courseId);
          if (!row || toPence(Number(row.price)) !== line.pricePence) {
            throw new Refusal("A price in your cart has changed. Please review your cart and try again.");
          }
        }

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: user.id,
            currency: CURRENCY,
            subtotal: toPounds(pricing.subtotalPence),
            discountTotal: toPounds(pricing.discountPence),
            total: toPounds(pricing.totalPence),
            couponId,
            couponCode,
            ...billingColumns(billing),
            email: user.email,
            expiresAt: orderExpiryDate(new Date()),
            items: {
              create: pricing.lines.map((line, i) => ({
                courseId: line.courseId,
                courseTitle: cart.items[i].course.title,
                unitPrice: toPounds(line.pricePence),
                discount: toPounds(line.discountPence),
                total: toPounds(line.totalPence),
              })),
            },
          },
          select: { id: true, orderNumber: true },
        });
        await addOrderEvent(
          order.id,
          {
            type: "CREATED",
            message: couponCode
              ? `Order placed with coupon ${couponCode}.`
              : "Order placed.",
            data: { totalPence: pricing.totalPence, discountPence: pricing.discountPence },
          },
          tx,
        );

        if (couponId) {
          const taken = await reserveCouponUse(tx, { couponId, userId: user.id, orderId: order.id, lines: cart.lines });
          if (!taken.ok) throw new Refusal(taken.message);
          // The coupon changed since it was evaluated above: do not charge a different amount.
          if (taken.pricing.totalPence !== pricing.totalPence) {
            throw new Refusal("The coupon changed while you were checking out. Please review your cart and try again.");
          }
        }
        if (free) await markFreeOrderPaid(tx, order.id);
        return { ...order, reused: false };
      });
    } catch (error) {
      if (isOrderNumberClash(error)) continue;
      if (error instanceof Refusal) return { ok: false, error: error.message, dropCoupon: Boolean(couponId) && error.message.includes("coupon") };
      throw error;
    }
  }
  if (!created) return { ok: false, error: "We could not create your order. Please try again." };

  if (!created.reused) {
    await logActivity({
      userId: user.id,
      action: "order.place",
      entity: "order",
      entityId: created.id,
      details: { orderNumber: created.orderNumber, totalPence: pricing.totalPence, coupon: couponCode },
    });
  }

  if (free) {
    await fulfilOrder(created.id);
    await logActivity({
      userId: user.id,
      action: "order.paid",
      entity: "order",
      entityId: created.id,
      details: { orderNumber: created.orderNumber, totalPence: 0 },
    });
    await sendOrderConfirmedEmail(created.id);
    return { ok: true, kind: "free", orderNumber: created.orderNumber };
  }

  const started = await startStripePayment(created.id);
  if (!started.ok) {
    // The order stays pending; the buyer can pay it again from its page.
    return { ok: false, error: started.error, orderNumber: created.orderNumber };
  }
  return { ok: true, kind: "pay", orderNumber: created.orderNumber, url: started.url };
}
