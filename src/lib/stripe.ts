import "server-only";
import Stripe from "stripe";
import { getSettings } from "@/lib/settings-store";

// The one place that talks to Stripe. Keys come from Settings > Payments (or
// the server's .env file) and never leave the server; with them unset the site
// still runs, and anything that would need Stripe checks isStripeConfigured()
// first (paid checkout is then unavailable, orders that total 0 still complete).

export function isStripeConfigured() {
  return Boolean(getSettings().payment.stripeSecretKey);
}

// New paid orders: Stripe is set up and "Take payments" is on. Orders already
// placed are still looked up and refunded with isStripeConfigured() alone.
export function canTakePayments() {
  return isStripeConfigured() && getSettings().payment.takePayments;
}

let client: { key: string; stripe: Stripe } | undefined;

// Created on first use so importing this file never needs a key, and again
// when the key is changed. Uses the API version the installed package is built
// for (not pinned here).
export function getStripe(): Stripe {
  const key = getSettings().payment.stripeSecretKey;
  if (!key) throw new Error("Stripe is not configured: add the secret key in Settings > Payments.");
  if (client?.key !== key) client = { key, stripe: new Stripe(key) };
  return client.stripe;
}

// Signing secret of the webhook endpoint (`whsec_...`), or null when unset.
export function getStripeWebhookSecret() {
  return getSettings().payment.stripeWebhookSecret || null;
}

// Checks the Stripe-Signature header against the raw request body and returns
// the event; throws when the signature is wrong or too old. Needs no API key.
export function verifyStripeEvent(rawBody: string, signature: string, secret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
