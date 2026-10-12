import "server-only";
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { isWebhookSecretFormat } from "@/lib/commerce";
import { db } from "@/lib/db";
import { getStripeWebhookSecret, verifyStripeEvent } from "@/lib/stripe";
import { applyCheckoutSession } from "@/services/payment";
import { applyStripeRefund } from "@/services/refund";

// Stripe's webhook: verify the signature, record the event id, dispatch.

export type WebhookResponse = { status: number; message: string };

type Handler = (event: Stripe.Event) => Promise<void>;

const checkoutSession = (event: Stripe.Event) => event.data.object as Stripe.Checkout.Session;

// One entry per event type we act on; anything else is acknowledged and
// ignored. Refunds arrive as refund.created / refund.updated / refund.failed
// (charge.refunded would only repeat them, so it is not handled).
export const stripeEventHandlers: Record<string, Handler> = {
  "checkout.session.completed": async (event) => {
    await applyCheckoutSession(checkoutSession(event));
  },
  "checkout.session.async_payment_succeeded": async (event) => {
    await applyCheckoutSession(checkoutSession(event));
  },
  "checkout.session.async_payment_failed": async (event) => {
    await applyCheckoutSession(checkoutSession(event), { hint: "async_failed" });
  },
  "checkout.session.expired": async (event) => {
    await applyCheckoutSession(checkoutSession(event));
  },
  "refund.created": async (event) => {
    await applyStripeRefund(event.data.object as Stripe.Refund);
  },
  "refund.updated": async (event) => {
    await applyStripeRefund(event.data.object as Stripe.Refund);
  },
  "refund.failed": async (event) => {
    await applyStripeRefund(event.data.object as Stripe.Refund);
  },
};

let warnedAboutSecret = false;

// The whole webhook, minus the HTTP wrapper, so it can be called with a signed
// test event. `secret` defaults to the environment's. Never accepts an
// unsigned event: without a well-formed secret nothing is processed.
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string | null = getStripeWebhookSecret(),
): Promise<WebhookResponse> {
  if (!isWebhookSecretFormat(secret)) {
    if (!warnedAboutSecret) {
      warnedAboutSecret = true;
      console.error("Stripe webhook refused: STRIPE_WEBHOOK_SECRET is missing or is not a whsec_ signing secret.");
    }
    return { status: 503, message: "Webhook is not configured." };
  }
  if (!signature) return { status: 400, message: "Missing signature." };

  let event: Stripe.Event;
  try {
    event = verifyStripeEvent(rawBody, signature, secret);
  } catch {
    return { status: 400, message: "Invalid signature." };
  }

  const handler = stripeEventHandlers[event.type];
  if (!handler) return { status: 200, message: "Ignored." };

  // The event id goes in first: a duplicate-key error means it was handled (or is being handled).
  try {
    await db.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: 200, message: "Already handled." };
    }
    throw error;
  }

  try {
    await handler(event);
  } catch (error) {
    // Forget the event so Stripe's retry runs it again.
    await db.processedStripeEvent.deleteMany({ where: { id: event.id } });
    console.error(`Stripe webhook ${event.type} (${event.id}) failed`, error instanceof Error ? error.message : error);
    return { status: 500, message: "Could not process the event." };
  }
  return { status: 200, message: "Handled." };
}
