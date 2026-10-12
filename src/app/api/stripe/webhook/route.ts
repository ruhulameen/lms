import { handleStripeWebhook } from "@/services/stripe-webhook";

export const runtime = "nodejs";

// Stripe posts payment events here. The body must stay raw (it is what the
// signature covers), so it is read as text and nothing parses it first.
export async function POST(request: Request) {
  const body = await request.text();
  const { status, message } = await handleStripeWebhook(body, request.headers.get("stripe-signature"));
  return Response.json({ message }, { status });
}
