import "server-only";
import Stripe from "stripe";

// The one place that talks to Stripe. Keys come from the environment and never
// leave the server; with them unset the site still runs, and anything that
// would need Stripe checks isStripeConfigured() first (paid checkout is then
// unavailable, orders that total 0 still complete).

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | undefined;

// Created on first use so importing this file never needs a key. Uses the API
// version the installed package is built for (not pinned here).
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured: set STRIPE_SECRET_KEY.");
  client ??= new Stripe(key);
  return client;
}

// Signing secret of the webhook endpoint (`whsec_...`), or null when unset.
export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

// Checks the Stripe-Signature header against the raw request body and returns
// the event; throws when the signature is wrong or too old. Needs no API key.
export function verifyStripeEvent(rawBody: string, signature: string, secret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}
