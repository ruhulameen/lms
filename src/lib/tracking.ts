// Shared by the browser tags (src/components/site/tracking.tsx) and the server
// (src/services/tracking.ts): cookie names, the events the site reports, and
// how "where did this visitor come from" is read. Pure, no browser or server APIs.

// The visitor's answer to the cookie banner: "granted" or "denied".
export const CONSENT_COOKIE = "lms_consent";
// Where the visitor came from (JSON, see Attribution). Only written with consent.
export const ATTRIBUTION_COOKIE = "lms_attr";
// Events the server wants the browser to report on the next page (JSON array).
export const PENDING_EVENTS_COOKIE = "lms_events";

export const ATTRIBUTION_DAYS = 90;

// What the browser needs to load the tags. No secrets.
export type PublicTracking = {
  consentBanner: boolean;
  gtmId: string;
  ga4Id: string;
  metaPixelId: string;
  googleAdsId: string;
  googleAdsPurchaseLabel: string;
  tiktokPixelId: string;
  linkedinPartnerId: string;
  // Purchases reach Google Analytics from the server, so the browser must not send them too.
  ga4PurchaseFromServer: boolean;
  currency: string;
};

export function hasAnyTag(config: PublicTracking) {
  return Boolean(config.gtmId || config.ga4Id || config.metaPixelId || config.googleAdsId || config.tiktokPixelId || config.linkedinPartnerId);
}

export type TrackItem = { id: string; name: string; price: number; category?: string };

// The moments the site reports, in Google's naming; each platform's own name
// is mapped in the browser component.
export type TrackEventPayload =
  | { event: "view_item"; value: number; items: TrackItem[] }
  | { event: "add_to_cart"; value: number; items: TrackItem[] }
  | { event: "begin_checkout"; value: number; items: TrackItem[]; coupon?: string }
  | { event: "purchase"; value: number; items: TrackItem[]; coupon?: string; orderNumber: string }
  | { event: "sign_up" };

// Shared by the browser and the server so Meta counts the two reports of one purchase once.
export const purchaseEventId = (orderNumber: string) => `purchase-${orderNumber}`;

// Where a visitor came from. Every field optional and short.
export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  // Host of the page that linked here, when it was another site.
  referrer?: string;
  // Path the visit started on.
  landing?: string;
  // ISO date the visit started.
  at?: string;
};

const ATTRIBUTION_KEYS = ["source", "medium", "campaign", "term", "content", "gclid", "fbclid", "ttclid", "referrer", "landing", "at"] as const;
const MAX_LENGTH = 200;

// Keeps only known keys with short string values: the cookie is written by the
// browser, so anything may be in it. Null when nothing useful is left.
export function sanitiseAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) result[key] = value.trim().slice(0, MAX_LENGTH);
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function parseAttributionCookie(value: string | undefined | null): Attribution | null {
  if (!value) return null;
  try {
    return sanitiseAttribution(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}

// Reads a landing address. Campaign tags and ad click ids win; without them an
// outside referrer counts as a referral ("organic" for a search engine).
// Returns null for a visit with nothing to say (typed address, same-site link).
export function attributionFromVisit(url: string, referrer: string, now: Date): Attribution | null {
  let page: URL;
  try {
    page = new URL(url);
  } catch {
    return null;
  }
  const param = (name: string) => page.searchParams.get(name)?.trim() || undefined;
  const result: Attribution = {
    source: param("utm_source"),
    medium: param("utm_medium"),
    campaign: param("utm_campaign"),
    term: param("utm_term"),
    content: param("utm_content"),
    gclid: param("gclid"),
    fbclid: param("fbclid"),
    ttclid: param("ttclid"),
  };

  let referrerHost: string | undefined;
  try {
    const host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
    if (host && host !== page.hostname.replace(/^www\./, "")) referrerHost = host;
  } catch {}

  // An ad click id without tags still names its platform.
  if (!result.source) {
    if (result.gclid) Object.assign(result, { source: "google", medium: result.medium ?? "cpc" });
    else if (result.fbclid) Object.assign(result, { source: "facebook", medium: result.medium ?? "paid-social" });
    else if (result.ttclid) Object.assign(result, { source: "tiktok", medium: result.medium ?? "paid-social" });
    else if (referrerHost) Object.assign(result, { source: referrerHost, medium: isSearchEngine(referrerHost) ? "organic" : "referral" });
  }
  if (!result.source) return null;

  return sanitiseAttribution({ ...result, referrer: referrerHost, landing: page.pathname, at: now.toISOString() });
}

function isSearchEngine(host: string) {
  return /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu)\./.test(host);
}

// A campaign visit replaces what was remembered; a plain referral only fills an
// empty slot, so "came from an ad last week, from a blog today" stays the ad.
export function mergeAttribution(current: Attribution | null, visit: Attribution | null): Attribution | null {
  if (!visit) return current;
  if (!current) return visit;
  const isCampaign = Boolean(visit.campaign || visit.gclid || visit.fbclid || visit.ttclid || (visit.medium && visit.medium !== "referral" && visit.medium !== "organic"));
  return isCampaign ? visit : current;
}

// "google / cpc", "newsletter", "Direct": one label per order for the reports.
export function attributionLabel(attribution: Attribution | null) {
  if (!attribution?.source) return "Direct";
  return attribution.medium ? `${attribution.source} / ${attribution.medium}` : attribution.source;
}

// The client id Google Analytics keeps in its _ga cookie ("GA1.1.123.456" -> "123.456").
export function gaClientIdFromCookie(value: string | undefined | null) {
  const match = /^GA\d\.\d\.(\d+\.\d+)$/.exec(value ?? "");
  return match ? match[1] : null;
}

// The session id from a _ga_<container> cookie, in either format Google has used:
// "GS1.1.1700000000.3.1..." or "GS2.1.s1700000000$o3$g1...".
export function gaSessionIdFromCookie(value: string | undefined | null) {
  const match = /^GS\d\.\d\.s?(\d+)/.exec(value ?? "");
  return match ? match[1] : null;
}
