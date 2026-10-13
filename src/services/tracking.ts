import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings-store";
import {
  ATTRIBUTION_COOKIE,
  CONSENT_COOKIE,
  PENDING_EVENTS_COOKIE,
  gaClientIdFromCookie,
  gaSessionIdFromCookie,
  parseAttributionCookie,
  purchaseEventId,
  type PublicTracking,
  type TrackEventPayload,
} from "@/lib/tracking";

// The server's part of tracking: what the browser tags are given, what is
// remembered about a visitor when they sign up or order, and the purchase
// events sent straight to Meta and Google once an order is paid (they do not
// depend on the buyer's browser, ad blockers or the thank-you page loading).

export function getPublicTracking(): PublicTracking {
  const { tracking, payment } = getSettings();
  return {
    consentBanner: tracking.consentBanner,
    gtmId: tracking.gtmId,
    ga4Id: tracking.ga4Id,
    metaPixelId: tracking.metaPixelId,
    googleAdsId: tracking.googleAdsId,
    googleAdsPurchaseLabel: tracking.googleAdsPurchaseLabel,
    tiktokPixelId: tracking.tiktokPixelId,
    linkedinPartnerId: tracking.linkedinPartnerId,
    ga4PurchaseFromServer: Boolean(tracking.ga4Id && tracking.ga4ApiSecret),
    currency: payment.currency,
  };
}

// Whether this visitor may be tracked: they accepted the banner, or the site
// does not ask (banner switched off in Settings > Tracking).
async function hasConsent() {
  if (!getSettings().tracking.consentBanner) return true;
  return (await cookies()).get(CONSENT_COOKIE)?.value === "granted";
}

// Where the visitor came from, for the sign-up or the order being written.
export async function readAttribution(): Promise<Prisma.InputJsonObject | undefined> {
  const attribution = parseAttributionCookie((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
  return attribution ?? undefined;
}

type TrackingContext = {
  fbp?: string;
  fbc?: string;
  gaClientId?: string;
  gaSessionId?: string;
  ip?: string;
  userAgent?: string;
};

// What the server-side purchase event will need, read while the buyer's
// browser is here. Undefined without consent: nothing is kept, nothing is sent.
export async function readTrackingContext(): Promise<Prisma.InputJsonObject | undefined> {
  if (!(await hasConsent())) return undefined;
  const [jar, head] = await Promise.all([cookies(), headers()]);
  const { ga4Id } = getSettings().tracking;
  const short = (value: string | undefined | null, max = 300) => (value ? value.slice(0, max) : undefined);
  const context: TrackingContext = {
    fbp: short(jar.get("_fbp")?.value),
    fbc: short(jar.get("_fbc")?.value),
    gaClientId: gaClientIdFromCookie(jar.get("_ga")?.value) ?? undefined,
    gaSessionId: (ga4Id && gaSessionIdFromCookie(jar.get(`_ga_${ga4Id.replace(/^G-/, "")}`)?.value)) || undefined,
    ip: short(head.get("x-forwarded-for")?.split(",")[0]?.trim() || head.get("x-real-ip"), 64),
    userAgent: short(head.get("user-agent"), 500),
  };
  // `consented` marks the row even when every id is missing (ad blocker).
  return { consented: true, ...JSON.parse(JSON.stringify(context)) };
}

// Asks the browser to report an event on the page it loads next (a server
// action cannot run the tags itself). Read and cleared by the browser component.
export async function queueBrowserEvent(event: TrackEventPayload) {
  const jar = await cookies();
  let pending: unknown[] = [];
  try {
    const current = jar.get(PENDING_EVENTS_COOKIE)?.value;
    if (current) pending = JSON.parse(current);
  } catch {}
  if (!Array.isArray(pending)) pending = [];
  jar.set(PENDING_EVENTS_COOKIE, JSON.stringify([...pending.slice(-4), event]), { path: "/", maxAge: 120, sameSite: "lax" });
}

// A course as the tags describe it, or null when it is not on sale.
export async function trackItemForCourse(slug: string) {
  const course = await db.course.findUnique({
    where: { slug },
    select: { id: true, title: true, price: true, category: { select: { name: true } } },
  });
  if (!course) return null;
  return { id: String(course.id), name: course.title, price: Number(course.price), category: course.category?.name };
}

// ---------------------------------------------------------------- server-side purchase

const sha256 = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
}

// Reports the purchase once the response has gone out, so neither the buyer nor
// Stripe's webhook waits on the ad platforms.
export async function reportPurchase(orderId: number) {
  try {
    const { after } = await import("next/server");
    after(() => sendServerPurchase(orderId));
  } catch {
    void sendServerPurchase(orderId);
  }
}

// Reports a paid order to Meta (Conversions API) and Google Analytics
// (Measurement Protocol), whichever are set up. Sent once per order, only for
// buyers who agreed to tracking, and never throws: a failure is logged and the
// order is unaffected.
export async function sendServerPurchase(orderId: number) {
  const { tracking } = getSettings();
  const toMeta = Boolean(tracking.metaPixelId && tracking.metaAccessToken);
  const toGoogle = Boolean(tracking.ga4Id && tracking.ga4ApiSecret);
  if (!toMeta && !toGoogle) return;

  try {
    // Claimed first, so the webhook and the order page racing each other send one event.
    const claimed = await db.order.updateMany({
      where: { id: orderId, purchaseTrackedAt: null, status: "PAID" },
      data: { purchaseTrackedAt: new Date() },
    });
    if (claimed.count === 0) return;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        email: true,
        total: true,
        currency: true,
        couponCode: true,
        paidAt: true,
        trackingContext: true,
        billingFirstName: true,
        billingLastName: true,
        billingCountry: true,
        items: { select: { courseId: true, courseTitle: true, total: true } },
      },
    });
    if (!order) return;
    const context = (order.trackingContext ?? null) as (TrackingContext & { consented?: boolean }) | null;
    const value = Number(order.total);
    if (!context?.consented || value <= 0) return;

    const origin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
    const jobs: Promise<void>[] = [];

    if (toMeta) {
      jobs.push(
        post(`https://graph.facebook.com/v21.0/${encodeURIComponent(tracking.metaPixelId)}/events?access_token=${encodeURIComponent(tracking.metaAccessToken)}`, {
          data: [
            {
              event_name: "Purchase",
              event_time: Math.floor((order.paidAt ?? new Date()).getTime() / 1000),
              event_id: purchaseEventId(order.orderNumber),
              action_source: "website",
              event_source_url: `${origin}/checkout/order/${order.orderNumber}`,
              user_data: {
                em: [sha256(order.email)],
                fn: [sha256(order.billingFirstName)],
                ln: [sha256(order.billingLastName)],
                country: [sha256(order.billingCountry)],
                client_ip_address: context.ip,
                client_user_agent: context.userAgent,
                fbp: context.fbp,
                fbc: context.fbc,
              },
              custom_data: {
                currency: order.currency,
                value,
                order_id: order.orderNumber,
                content_type: "product",
                content_ids: order.items.map((item) => String(item.courseId)),
                num_items: order.items.length,
              },
            },
          ],
          ...(tracking.metaTestEventCode ? { test_event_code: tracking.metaTestEventCode } : {}),
        }).catch((error) => console.error(`[tracking] Meta purchase for ${order.orderNumber} failed:`, error instanceof Error ? error.message : error)),
      );
    }

    if (toGoogle) {
      jobs.push(
        post(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(tracking.ga4Id)}&api_secret=${encodeURIComponent(tracking.ga4ApiSecret)}`, {
          // Without the browser's id (blocked or cleared) the sale is still counted, as a new visitor.
          client_id: context.gaClientId ?? randomUUID(),
          events: [
            {
              name: "purchase",
              params: {
                transaction_id: order.orderNumber,
                value,
                currency: order.currency,
                ...(order.couponCode ? { coupon: order.couponCode } : {}),
                ...(context.gaSessionId ? { session_id: context.gaSessionId } : {}),
                engagement_time_msec: 1,
                items: order.items.map((item) => ({ item_id: String(item.courseId), item_name: item.courseTitle, price: Number(item.total), quantity: 1 })),
              },
            },
          ],
        }).catch((error) => console.error(`[tracking] Google Analytics purchase for ${order.orderNumber} failed:`, error instanceof Error ? error.message : error)),
      );
    }
    await Promise.all(jobs);
  } catch (error) {
    console.error(`[tracking] purchase for order ${orderId} could not be reported:`, error instanceof Error ? error.message : error);
  }
}

