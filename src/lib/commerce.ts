import { formatPrice } from "@/lib/format";

// The rules of selling courses, as pure functions with no database access: the
// services load rows, hand plain values in here and store what comes back.
// Money is whole pence inside this file (prices are Decimal(10,2) pounds in the
// database), so nothing is ever added up as floating-point pounds.
// Currency is GBP only; prices include VAT and no tax is calculated.

export const CURRENCY = "GBP";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

// Pounds (a number, or a Prisma Decimal turned into one) to whole pence.
export const toPence = (pounds: number) => Math.round(pounds * 100);
export const toPounds = (pence: number) => pence / 100;
// "£49", "£4.50", through the same formatter the storefront uses.
export const formatPence = (pence: number) => formatPrice(toPounds(pence));

// ---------------------------------------------------------------------------
// Cart and pricing
// ---------------------------------------------------------------------------

// What the rules need to know about one course in the cart (one of each).
export type PricedLine = {
  courseId: number;
  categoryId: number | null;
  pricePence: number;
};

export const sumPence = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

export const cartSubtotalPence = (lines: readonly PricedLine[]) => sumPence(lines.map((l) => l.pricePence));

// A course can be sold only when it costs something; free courses are joined directly.
export const isSellable = (pricePence: number) => pricePence > 0;

export type PricedOrderLine = PricedLine & {
  discountPence: number;
  totalPence: number;
};

export type OrderPricing = {
  lines: PricedOrderLine[];
  subtotalPence: number;
  discountPence: number;
  totalPence: number;
};

// Lines with their coupon share applied. `lineDiscounts` is parallel to
// `lines` (from checkCoupon) or omitted for no coupon.
export function priceOrder(lines: readonly PricedLine[], lineDiscounts?: readonly number[]): OrderPricing {
  const priced = lines.map((line, i) => {
    const discountPence = Math.min(Math.max(lineDiscounts?.[i] ?? 0, 0), line.pricePence);
    return { ...line, discountPence, totalPence: line.pricePence - discountPence };
  });
  return {
    lines: priced,
    subtotalPence: sumPence(priced.map((l) => l.pricePence)),
    discountPence: sumPence(priced.map((l) => l.discountPence)),
    totalPence: sumPence(priced.map((l) => l.totalPence)),
  };
}

// A total of 0 completes without Stripe.
export const isFreeOrder = (totalPence: number) => totalPence <= 0;

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export const couponDiscountTypes = ["PERCENTAGE", "FIXED"] as const;
export type CouponDiscountTypeValue = (typeof couponDiscountTypes)[number];

// A coupon as the rules see it. `value` is a percentage (0-100) or pounds.
// Empty courseIds and categoryIds mean the coupon is not restricted.
export type CouponRules = {
  code: string;
  discountType: CouponDiscountTypeValue;
  value: number;
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  minSpendPence: number | null;
  courseIds: readonly number[];
  categoryIds: readonly number[];
};

// Uses that count against the limits: redemptions not released, in total and by this learner.
export type CouponUsage = { total: number; byUser: number };

export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

// Codes are case-insensitive and stored upper-case. Returns null for anything
// that cannot be a code (so a lookup is not even attempted).
export function normaliseCouponCode(input: string) {
  const code = input.trim().toUpperCase();
  return COUPON_CODE_PATTERN.test(code) ? code : null;
}

export const couponRefusalReasons = [
  "unknown",
  "inactive",
  "not_started",
  "expired",
  "not_applicable",
  "min_spend",
  "already_used",
  "usage_limit",
] as const;
export type CouponRefusalReason = (typeof couponRefusalReasons)[number];

// Shown to the learner as is.
export const couponRefusalMessages: Record<CouponRefusalReason, string> = {
  unknown: "This coupon code is not valid.",
  inactive: "This coupon is not active.",
  not_started: "This coupon is not valid yet.",
  expired: "This coupon has expired.",
  not_applicable: "This coupon does not apply to the courses in your cart.",
  min_spend: "Your cart does not reach the minimum spend for this coupon.",
  already_used: "You have already used this coupon.",
  usage_limit: "This coupon has reached its usage limit.",
};

// A line matches if its course is listed OR its category is listed; with no
// restriction every line matches.
export function couponMatchesLine(rules: Pick<CouponRules, "courseIds" | "categoryIds">, line: PricedLine) {
  if (rules.courseIds.length === 0 && rules.categoryIds.length === 0) return true;
  return (
    rules.courseIds.includes(line.courseId) ||
    (line.categoryId !== null && rules.categoryIds.includes(line.categoryId))
  );
}

// Splits `totalPence` across `weights` pro rata in whole pence. The pieces sum
// exactly to the total: the leftover pence go one each to the largest
// fractional remainders (earlier lines first on a tie).
export function splitPence(totalPence: number, weights: readonly number[]): number[] {
  const weightSum = sumPence(weights);
  if (weights.length === 0) return [];
  if (weightSum <= 0 || totalPence <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalPence * w) / weightSum);
  const shares = exact.map(Math.floor);
  let leftover = totalPence - sumPence(shares);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (leftover <= 0) break;
    shares[index] += 1;
    leftover -= 1;
  }
  return shares;
}

// Discount per line (parallel to `lines`, in pence). Only matching lines are
// discounted. A percentage is taken of the matching lines' subtotal (rounded to
// the penny); a fixed amount is capped at that subtotal. Either way the total
// discount is then split across the matching lines pro rata by price.
export function calculateCouponDiscount(
  rules: Pick<CouponRules, "discountType" | "value" | "courseIds" | "categoryIds">,
  lines: readonly PricedLine[],
): number[] {
  const matching = lines.map((line) => couponMatchesLine(rules, line));
  const matchingSubtotal = sumPence(lines.filter((_, i) => matching[i]).map((l) => l.pricePence));
  const wanted =
    rules.discountType === "PERCENTAGE"
      ? Math.round((matchingSubtotal * Math.min(Math.max(rules.value, 0), 100)) / 100)
      : toPence(Math.max(rules.value, 0));
  const total = Math.min(wanted, matchingSubtotal);

  const matchingIndexes = lines.map((_, i) => i).filter((i) => matching[i]);
  const shares = splitPence(total, matchingIndexes.map((i) => lines[i].pricePence));
  const discounts = lines.map(() => 0);
  matchingIndexes.forEach((lineIndex, k) => {
    discounts[lineIndex] = shares[k];
  });
  return discounts;
}

export type CouponCheckInput = {
  // The coupon found for the typed code, or null when there is none.
  rules: CouponRules | null;
  lines: readonly PricedLine[];
  usage: CouponUsage;
  now: Date;
};

export type CouponCheckResult =
  | {
      ok: true;
      code: string;
      // Parallel to `lines`.
      lineDiscounts: number[];
      discountPence: number;
      pricing: OrderPricing;
    }
  | { ok: false; reason: CouponRefusalReason; message: string };

const refuse = (reason: CouponRefusalReason): CouponCheckResult => ({
  ok: false,
  reason,
  message: couponRefusalMessages[reason],
});

// Whether a coupon can be used on these lines now, and what it takes off.
// Minimum spend is tested against the MATCHING lines' subtotal (before the
// discount): a "£5 off £50 of Health courses" coupon is not met by £50 of
// unrelated courses. Checks run in the order of couponRefusalReasons.
export function checkCoupon({ rules, lines, usage, now }: CouponCheckInput): CouponCheckResult {
  if (!rules) return refuse("unknown");
  if (!rules.active) return refuse("inactive");
  if (rules.startsAt && now < rules.startsAt) return refuse("not_started");
  if (rules.expiresAt && now > rules.expiresAt) return refuse("expired");

  const matching = lines.filter((line) => couponMatchesLine(rules, line));
  if (matching.length === 0) return refuse("not_applicable");
  if (rules.minSpendPence !== null && cartSubtotalPence(matching) < rules.minSpendPence) return refuse("min_spend");

  if (rules.perUserLimit !== null && usage.byUser >= rules.perUserLimit) return refuse("already_used");
  if (rules.usageLimit !== null && usage.total >= rules.usageLimit) return refuse("usage_limit");

  const lineDiscounts = calculateCouponDiscount(rules, lines);
  const pricing = priceOrder(lines, lineDiscounts);
  return { ok: true, code: rules.code, lineDiscounts, discountPence: pricing.discountPence, pricing };
}

// ---------------------------------------------------------------------------
// Order numbers
// ---------------------------------------------------------------------------

// ORD-20261013-K7M2QX. Same alphabet as certificate codes (no 0/O, 1/I/L): 31^6
// is about 887 million suffixes a day, so numbers cannot be walked through one
// by one. The number is not a secret, though: every order page also checks
// that the order belongs to the signed-in user (or that staff may view it).
export const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ORDER_NUMBER_PATTERN = /^ORD-\d{8}-[2-9A-HJKMNP-Z]{6}$/;

export function generateOrderNumber(
  now: Date = new Date(),
  random: (length: number) => Uint8Array = (length) => crypto.getRandomValues(new Uint8Array(length)),
) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const chars: string[] = [];
  // Bytes at or above this would favour the first symbols; draw again.
  const limit = 256 - (256 % ORDER_NUMBER_ALPHABET.length);
  while (chars.length < 6) {
    for (const byte of random(12)) {
      if (byte < limit && chars.length < 6) chars.push(ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length]);
    }
  }
  return `ORD-${date}-${chars.join("")}`;
}

// ---------------------------------------------------------------------------
// Order status
// ---------------------------------------------------------------------------

export const orderStatuses = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export type OrderStatusValue = (typeof orderStatuses)[number];

export const orderStatusLabels: Record<OrderStatusValue, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

// Allowed moves. FAILED and CANCELLED can still become PAID because a verified
// "payment succeeded" from Stripe must never be dropped (a payment completing
// just as the order expired): the webhook then re-takes the coupon use if it
// can and records the late payment on the timeline.
const transitions: Record<OrderStatusValue, readonly OrderStatusValue[]> = {
  PENDING: ["PAID", "FAILED", "CANCELLED"],
  FAILED: ["PAID"],
  CANCELLED: ["PAID"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [],
};

export const canTransition = (from: OrderStatusValue, to: OrderStatusValue) => transitions[from].includes(to);

// The statuses in which the buyer holds access to what was bought.
export const isPaidStatus = (status: OrderStatusValue) =>
  status === "PAID" || status === "PARTIALLY_REFUNDED" || status === "REFUNDED";

// Statuses in which the coupon use stays counted.
export const holdsCouponUse = (status: OrderStatusValue) => status === "PENDING" || isPaidStatus(status);

// A pending order is payable until it expires.
export const ORDER_EXPIRY_MINUTES = 60;
export const orderExpiryDate = (now: Date) => new Date(now.getTime() + ORDER_EXPIRY_MINUTES * 60_000);
export const isOrderExpired = (order: { status: OrderStatusValue; expiresAt: Date | null }, now: Date) =>
  order.status === "PENDING" && order.expiresAt !== null && order.expiresAt <= now;

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export type RefundableItem = { id: number; totalPence: number; refunded: boolean };

export type RefundPlan =
  | {
      ok: true;
      amountPence: number;
      itemIds: number[];
      // The amount per item, parallel to itemIds.
      itemAmountsPence: number[];
      refundedTotalPence: number;
      status: "PARTIALLY_REFUNDED" | "REFUNDED";
    }
  | { ok: false; reason: "not_refundable" | "nothing_selected" | "unknown_item" | "already_refunded" };

// Refunding whole lines only: the amount is what each line cost after its
// coupon share. `itemIds` null means every line not yet refunded (a whole-order
// refund). A zero amount is allowed (a line a coupon made free): there is then
// nothing to send to Stripe but the access still goes.
export function planRefund(input: {
  status: OrderStatusValue;
  items: readonly RefundableItem[];
  refundedTotalPence: number;
  itemIds: readonly number[] | null;
}): RefundPlan {
  if (!canTransition(input.status, "PARTIALLY_REFUNDED")) return { ok: false, reason: "not_refundable" };

  const selected = input.itemIds === null ? input.items.filter((i) => !i.refunded) : null;
  let chosen: RefundableItem[];
  if (selected) {
    chosen = selected;
  } else {
    const ids = new Set(input.itemIds);
    chosen = input.items.filter((i) => ids.has(i.id));
    if (chosen.length !== ids.size) return { ok: false, reason: "unknown_item" };
    if (chosen.some((i) => i.refunded)) return { ok: false, reason: "already_refunded" };
  }
  if (chosen.length === 0) return { ok: false, reason: "nothing_selected" };

  const amountPence = sumPence(chosen.map((i) => i.totalPence));
  const refundedIds = new Set([...input.items.filter((i) => i.refunded).map((i) => i.id), ...chosen.map((i) => i.id)]);
  return {
    ok: true,
    amountPence,
    itemIds: chosen.map((i) => i.id),
    itemAmountsPence: chosen.map((i) => i.totalPence),
    refundedTotalPence: input.refundedTotalPence + amountPence,
    status: refundedIds.size === input.items.length ? "REFUNDED" : "PARTIALLY_REFUNDED",
  };
}

// ---------------------------------------------------------------------------
// Checkout sessions (what Stripe reports about a payment attempt)
// ---------------------------------------------------------------------------

// The few facts of a Stripe Checkout Session the order rules look at, as plain
// values so the decision below stays free of the Stripe library.
export type CheckoutSessionFacts = {
  status: string | null;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  // Only when the session is complete but unpaid: the PaymentIntent's state.
  paymentIntentStatus?: string | null;
};

export type CheckoutSessionOutcome =
  | { kind: "paid" }
  // Stripe says paid but the amount or currency is not the order's: a problem to look at, never "paid".
  | { kind: "mismatch"; message: string }
  // Complete but the money has not arrived (a delayed payment method).
  | { kind: "processing" }
  | { kind: "failed"; message: string }
  | { kind: "expired" }
  // Still waiting for the buyer on Stripe's page.
  | { kind: "open" };

// `hint` carries what only the event type tells (checkout.session.async_payment_failed
// arrives on a complete, unpaid session).
export function classifyCheckoutSession(
  facts: CheckoutSessionFacts,
  expected: { totalPence: number },
  hint?: "async_failed",
): CheckoutSessionOutcome {
  if (hint === "async_failed") return { kind: "failed", message: "The payment did not go through." };
  if (facts.status === "expired") return { kind: "expired" };
  if (facts.status !== "complete") return { kind: "open" };

  if (facts.paymentStatus === "paid" || facts.paymentStatus === "no_payment_required") {
    if (facts.amountTotal !== expected.totalPence || facts.currency?.toUpperCase() !== CURRENCY) {
      return {
        kind: "mismatch",
        message: `Stripe reported ${formatPence(facts.amountTotal ?? 0)} ${facts.currency?.toUpperCase() ?? "?"} but the order total is ${formatPence(expected.totalPence)} ${CURRENCY}.`,
      };
    }
    return { kind: "paid" };
  }
  if (facts.paymentIntentStatus === "requires_payment_method" || facts.paymentIntentStatus === "canceled") {
    return { kind: "failed", message: "The payment did not go through." };
  }
  return { kind: "processing" };
}

// Stripe accepts a session lifetime of 30 minutes to 24 hours. Aim for the
// order's own expiry; with less than 31 minutes left the session outlives the
// order slightly, and a payment that lands late is still accepted.
export function checkoutSessionExpiry(orderExpiresAt: Date | null, now: Date): number {
  const earliest = now.getTime() + 31 * 60_000;
  const latest = now.getTime() + 23 * 60 * 60_000;
  const wanted = orderExpiresAt ? orderExpiresAt.getTime() : orderExpiryDate(now).getTime();
  return Math.floor(Math.min(Math.max(wanted, earliest), latest) / 1000);
}

// A webhook signing secret looks like whsec_ plus a long token.
export const isWebhookSecretFormat = (secret: string | null | undefined): secret is string =>
  typeof secret === "string" && /^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(secret);

// Two carts are the same order when the same courses, coupon and total are asked for.
export function orderSignature(input: { courseIds: readonly number[]; couponCode: string | null; totalPence: number }) {
  return `${[...input.courseIds].sort((a, b) => a - b).join(",")}|${input.couponCode ?? ""}|${input.totalPence}`;
}
