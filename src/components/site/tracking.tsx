"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_DAYS,
  CONSENT_COOKIE,
  PENDING_EVENTS_COOKIE,
  attributionFromVisit,
  hasAnyTag,
  mergeAttribution,
  parseAttributionCookie,
  purchaseEventId,
  type PublicTracking,
  type TrackEventPayload,
} from "@/lib/tracking";

// Everything tracking does in the browser: the cookie banner, loading the tags
// set up in Settings > Tracking once the visitor agrees, page views, the shop
// events, and remembering which campaign the visitor came from. Nothing loads
// and nothing is stored before consent (or at all in the admin panels).

/* eslint-disable @typescript-eslint/no-explicit-any -- the vendors' globals are untyped */
type Win = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: any;
  _fbq?: any;
  ttq?: any;
  TiktokAnalyticsObject?: string;
  lintrk?: any;
  _linkedin_partner_id?: string;
  _linkedin_data_partner_ids?: string[];
  // Set once the tags are running.
  __lmsTracking?: PublicTracking;
  // Events reported before that: a page reports in its own effect, which runs
  // before this component's, and the visitor may not have answered the banner yet.
  __lmsEvents?: TrackEventPayload[];
};
const win = () => window as Win;

// ---------------------------------------------------------------- cookies

function readCookie(name: string) {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${Math.round(days * 86400)}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}

// ---------------------------------------------------------------- consent

type Consent = "granted" | "denied" | "unset";
const CONSENT_EVENT = "lms:consent";
const OPEN_EVENT = "lms:cookie-settings";

function readConsent(): Consent {
  const value = readCookie(CONSENT_COOKIE);
  return value === "granted" || value === "denied" ? value : "unset";
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

function saveConsent(value: "granted" | "denied") {
  // A refusal is asked again after six months, an agreement after a year.
  writeCookie(CONSENT_COOKIE, value, value === "granted" ? 365 : 180);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

// Reopens the banner, for the "Cookie settings" link in the footer.
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}

// ---------------------------------------------------------------- loading the tags

function loadScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function loadTags(config: PublicTracking) {
  const w = win();

  // Google: one gtag for Analytics and Ads. Consent was given before this runs,
  // which Google is told in its own terms (Consent Mode).
  const googleIds = [config.ga4Id, config.googleAdsId].filter(Boolean);
  if (googleIds.length > 0 || config.gtmId) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function gtag() {
      // Google's library reads the arguments object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag("consent", "default", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
  }
  if (googleIds.length > 0) {
    w.gtag!("js", new Date());
    for (const id of googleIds) w.gtag!("config", id);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleIds[0])}`);
  }
  if (config.gtmId) {
    w.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`);
  }

  // Meta Pixel.
  if (config.metaPixelId && !w.fbq) {
    const fbq: any = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    w.fbq = fbq;
    w._fbq = fbq;
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", config.metaPixelId);
    fbq("track", "PageView");
  }

  // TikTok Pixel.
  if (config.tiktokPixelId && !w.ttq) {
    const ttq: any = [];
    w.TiktokAnalyticsObject = "ttq";
    w.ttq = ttq;
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
    for (const method of ttq.methods as string[]) {
      ttq[method] = (...args: unknown[]) => ttq.push([method, ...args]);
    }
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    const id = config.tiktokPixelId;
    ttq._i = { [id]: Object.assign([], { _u: url }) };
    ttq._t = { [id]: Date.now() };
    ttq._o = { [id]: {} };
    loadScript(`${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
    ttq.page();
  }

  // LinkedIn Insight Tag: page views and audiences only.
  if (config.linkedinPartnerId && !w.lintrk) {
    w._linkedin_partner_id = config.linkedinPartnerId;
    w._linkedin_data_partner_ids = [config.linkedinPartnerId];
    const lintrk: any = (a: unknown, b: unknown) => lintrk.q.push([a, b]);
    lintrk.q = [];
    w.lintrk = lintrk;
    loadScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
  }
}

// ---------------------------------------------------------------- events

function send(config: PublicTracking, payload: TrackEventPayload) {
  const w = win();
  const currency = config.currency;

  if (payload.event === "sign_up") {
    w.gtag?.("event", "sign_up", { method: "email" });
    w.fbq?.("track", "CompleteRegistration");
    w.ttq?.track("CompleteRegistration");
    if (config.gtmId) w.dataLayer?.push({ event: "sign_up" });
    return;
  }

  const { value, items } = payload;
  const googleItems = items.map((item) => ({ item_id: item.id, item_name: item.name, price: item.price, item_category: item.category, quantity: 1 }));
  const coupon = "coupon" in payload ? payload.coupon : undefined;
  const ecommerce = { currency, value, items: googleItems, ...(coupon ? { coupon } : {}) };
  const meta = { currency, value, content_type: "product", content_ids: items.map((item) => item.id), num_items: items.length };
  const tiktok = { currency, value, contents: items.map((item) => ({ content_id: item.id, content_name: item.name, content_type: "product", price: item.price, quantity: 1 })) };

  switch (payload.event) {
    case "view_item":
      w.gtag?.("event", "view_item", ecommerce);
      w.fbq?.("track", "ViewContent", { ...meta, content_name: items[0]?.name });
      w.ttq?.track("ViewContent", tiktok);
      break;
    case "add_to_cart":
      w.gtag?.("event", "add_to_cart", ecommerce);
      w.fbq?.("track", "AddToCart", meta);
      w.ttq?.track("AddToCart", tiktok);
      break;
    case "begin_checkout":
      w.gtag?.("event", "begin_checkout", ecommerce);
      w.fbq?.("track", "InitiateCheckout", meta);
      w.ttq?.track("InitiateCheckout", tiktok);
      break;
    case "purchase": {
      const transaction = { ...ecommerce, transaction_id: payload.orderNumber };
      // Analytics gets the purchase from the server when that is set up; sending
      // it here too would count the sale twice.
      if (config.ga4Id && !config.ga4PurchaseFromServer) w.gtag?.("event", "purchase", { ...transaction, send_to: config.ga4Id });
      if (config.googleAdsId && config.googleAdsPurchaseLabel) {
        w.gtag?.("event", "conversion", { send_to: `${config.googleAdsId}/${config.googleAdsPurchaseLabel}`, value, currency, transaction_id: payload.orderNumber });
      }
      // The same id as the server's report, so Meta counts one purchase.
      w.fbq?.("track", "Purchase", meta, { eventID: purchaseEventId(payload.orderNumber) });
      w.ttq?.track("CompletePayment", tiktok);
      if (config.gtmId) w.dataLayer?.push({ ecommerce: null }, { event: "purchase", ecommerce: transaction });
      return;
    }
  }
  // Tag Manager gets the same event for whatever tags are set up inside it.
  if (config.gtmId) w.dataLayer?.push({ ecommerce: null }, { event: payload.event, ecommerce });
}

// Reports an event to every tag that is switched on. Safe to call anywhere in
// the browser: before consent, or with no tags, it does nothing.
export function trackEvent(payload: TrackEventPayload) {
  const w = win();
  if (w.__lmsTracking) return send(w.__lmsTracking, payload);
  // Kept until the tags run (dropped with the page if they never do).
  w.__lmsEvents = [...(w.__lmsEvents ?? []).slice(-19), payload];
}

// Renders nothing; reports one event when the page it sits on is shown.
// `once` names the event so a reload does not report it again (a purchase).
export function TrackEvent({ payload, once }: { payload: TrackEventPayload; once?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (once) {
      try {
        if (localStorage.getItem(`lms-tracked:${once}`)) return;
        localStorage.setItem(`lms-tracked:${once}`, "1");
      } catch {}
    }
    trackEvent(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one report per mount
  }, []);
  return null;
}

// Events a server action left for this page (added to cart, signed up).
function flushPendingEvents() {
  const raw = readCookie(PENDING_EVENTS_COOKIE);
  if (!raw) return;
  document.cookie = `${PENDING_EVENTS_COOKIE}=; path=/; max-age=0`;
  try {
    const events = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(events)) for (const event of events) trackEvent(event as TrackEventPayload);
  } catch {}
}

// ---------------------------------------------------------------- where the visitor came from

const VISIT_KEY = "lms-visit";

// Read once per browser session from the landing address, and written to the
// cookie only once the visitor agrees.
function rememberAttribution(allowed: boolean) {
  try {
    let visit = sessionStorage.getItem(VISIT_KEY);
    if (visit === null) {
      visit = JSON.stringify(attributionFromVisit(location.href, document.referrer, new Date()));
      sessionStorage.setItem(VISIT_KEY, visit);
    }
    if (!allowed) return;
    const merged = mergeAttribution(parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE)), JSON.parse(visit));
    if (merged) writeCookie(ATTRIBUTION_COOKIE, encodeURIComponent(JSON.stringify(merged)), ATTRIBUTION_DAYS);
  } catch {}
}

// ---------------------------------------------------------------- the component

const isPanel = (pathname: string) => pathname.startsWith("/admin") || pathname.startsWith("/instructor");

export function Tracking({ config }: { config: PublicTracking }) {
  const pathname = usePathname();
  const consent = useSyncExternalStore<Consent>(subscribeConsent, readConsent, () => "unset");
  const [reopened, setReopened] = useState(false);
  const loaded = useRef(false);
  const lastPath = useRef<string | null>(null);

  const active = hasAnyTag(config) && !isPanel(pathname);
  const allowed = active && (!config.consentBanner || consent === "granted");

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (!active) return;
    const w = win();
    rememberAttribution(allowed);
    if (!allowed) return;
    if (!loaded.current) {
      loaded.current = true;
      loadTags(config);
      w.__lmsTracking = config;
      for (const event of (w.__lmsEvents ?? []).splice(0)) send(config, event);
      lastPath.current = pathname;
    } else if (lastPath.current !== pathname) {
      // A move between pages without a reload. Google Analytics notices these
      // itself; the pixels have to be told.
      lastPath.current = pathname;
      w.fbq?.("track", "PageView");
      w.ttq?.page();
    }
    flushPendingEvents();
  }, [active, allowed, config, pathname]);

  const answer = useCallback((value: "granted" | "denied") => {
    saveConsent(value);
    setReopened(false);
    // Tags already running cannot be unloaded: a fresh page starts without them.
    if (value === "denied" && loaded.current) location.reload();
  }, []);

  const showBanner = config.consentBanner && hasAnyTag(config) && !isPanel(pathname) && (consent === "unset" || reopened);
  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5 print:hidden"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-navy">We use cookies</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            Some are needed to run the site and are always on. With your permission we also use analytics and advertising cookies to see how the site is used
            and to show you relevant adverts elsewhere. You can change your mind at any time from &ldquo;Cookie settings&rdquo; at the bottom of the page.{" "}
            <Link href="/contact" className="font-semibold text-blue-600 hover:underline">
              Contact us
            </Link>{" "}
            if you have questions.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => answer("denied")}>
            Reject
          </Button>
          <Button type="button" onClick={() => answer("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
