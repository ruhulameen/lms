"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { billingFields, billingSchema, type BillingFormValues } from "@/lib/checkout";
import { ORDER_NUMBER_PATTERN } from "@/lib/commerce";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginHref } from "@/lib/return-path";
import { readCartLines, writeCartLines, writeCouponCode } from "@/services/cart";
import { placeOrder } from "@/services/checkout";
import { getOrderByNumber } from "@/services/order";
import { expireOrderIfDue, orderPagePath, startStripePayment } from "@/services/payment";
import { getCurrentUser } from "@/services/user";

const MINUTE = 60;

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// The "Pay" button of checkout: validates the billing details, creates the
// order from the cart and goes to Stripe (or straight to the confirmation for
// a free order).
export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref("/checkout"));

  const limited = await checkRateLimit("checkout", [
    { scope: "user", value: user.id, limit: 10, windowSeconds: 15 * MINUTE },
    { scope: "ip", limit: 30, windowSeconds: 15 * MINUTE },
  ]);
  if (limited) return { error: limited };

  const values = Object.fromEntries(billingFields.map((field) => [field, String(formData.get(field) ?? "")])) as BillingFormValues;
  const parsed = billingSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Check your billing details.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await placeOrder(user, parsed.data);
  if (!result.ok) {
    if (result.dropCoupon) await writeCouponCode(null);
    if (result.orderNumber) redirect(`${orderPagePath(result.orderNumber)}?error=payment`);
    return { error: result.error };
  }
  // Redirects must not sit inside a try block, and this is the only exit.
  redirect(result.kind === "free" ? `${orderPagePath(result.orderNumber)}?paid=1` : result.url);
}

export type PayAgainState = { error?: string };

// "Pay again" on a pending order: a new Stripe page if the order has not
// expired, otherwise the order is expired and the learner starts over.
export async function payPendingOrder(_prev: PayAgainState, formData: FormData): Promise<PayAgainState> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(loginHref("/checkout"));
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) return { error: "Order not found." };

  const limited = await checkRateLimit("pay-order", [{ scope: "user", value: user.id, limit: 15, windowSeconds: 15 * MINUTE }]);
  if (limited) return { error: limited };

  const order = await getOrderByNumber(orderNumber, { userId: user.id, staff: false });
  if (!order) return { error: "Order not found." };
  if (order.status !== "PENDING") redirect(orderPagePath(orderNumber));

  if (await expireOrderIfDue(order.id)) redirect("/cart");

  const started = await startStripePayment(order.id);
  if (!started.ok) {
    if (started.status !== "PENDING") redirect(orderPagePath(orderNumber));
    return { error: started.error };
  }
  redirect(started.url);
}

// Called by the confirmation page once the order is paid: takes the bought
// courses (and the coupon that was used) out of the cart cookies, which a page
// cannot do while rendering.
export async function clearCartAfterPayment(orderNumber: string) {
  const user = await getCurrentUser();
  if (!user || !ORDER_NUMBER_PATTERN.test(orderNumber)) return;
  const order = await getOrderByNumber(orderNumber, { userId: user.id, staff: false });
  if (!order || order.status === "PENDING" || order.status === "FAILED" || order.status === "CANCELLED") return;

  const bought = new Set(order.items.map((item) => item.course.slug));
  const lines = await readCartLines();
  const remaining = lines.filter((line) => !bought.has(line.slug));
  if (remaining.length !== lines.length) await writeCartLines(remaining);
  if (order.couponCode) await writeCouponCode(null);
}
