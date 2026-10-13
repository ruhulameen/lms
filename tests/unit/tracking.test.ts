import { describe, expect, it } from "vitest";
import {
  attributionFromVisit,
  attributionLabel,
  gaClientIdFromCookie,
  gaSessionIdFromCookie,
  mergeAttribution,
  parseAttributionCookie,
  sanitiseAttribution,
} from "@/lib/tracking";

const now = new Date("2026-10-13T09:00:00Z");

describe("attributionFromVisit", () => {
  it("reads campaign tags", () => {
    expect(attributionFromVisit("https://site.test/courses?utm_source=newsletter&utm_medium=email&utm_campaign=autumn", "", now)).toEqual({
      source: "newsletter",
      medium: "email",
      campaign: "autumn",
      landing: "/courses",
      at: now.toISOString(),
    });
  });

  it("names the platform from an ad click id", () => {
    expect(attributionFromVisit("https://site.test/?gclid=abc", "", now)).toMatchObject({ source: "google", medium: "cpc", gclid: "abc" });
    expect(attributionFromVisit("https://site.test/?fbclid=abc", "https://l.facebook.com/", now)).toMatchObject({ source: "facebook", medium: "paid-social" });
  });

  it("falls back to the referring site, and to nothing for a direct or same-site visit", () => {
    expect(attributionFromVisit("https://site.test/", "https://www.google.com/search", now)).toMatchObject({ source: "google.com", medium: "organic" });
    expect(attributionFromVisit("https://site.test/", "https://blog.example.org/post", now)).toMatchObject({ source: "blog.example.org", medium: "referral" });
    expect(attributionFromVisit("https://site.test/courses", "https://www.site.test/", now)).toBeNull();
    expect(attributionFromVisit("https://site.test/", "", now)).toBeNull();
  });
});

describe("mergeAttribution", () => {
  const ad = { source: "facebook", medium: "paid-social", campaign: "autumn" };
  const blog = { source: "blog.example.org", medium: "referral" };

  it("lets a campaign replace what was remembered, but not a plain referral", () => {
    expect(mergeAttribution(blog, ad)).toEqual(ad);
    expect(mergeAttribution(ad, blog)).toEqual(ad);
    expect(mergeAttribution(null, blog)).toEqual(blog);
    expect(mergeAttribution(ad, null)).toEqual(ad);
  });
});

describe("attribution from the cookie", () => {
  it("keeps known short strings only", () => {
    expect(sanitiseAttribution({ source: " google ", evil: "<script>", medium: 5, campaign: "x".repeat(500) })).toEqual({ source: "google", campaign: "x".repeat(200) });
    expect(sanitiseAttribution(["a"])).toBeNull();
    expect(parseAttributionCookie(encodeURIComponent(JSON.stringify({ source: "tiktok" })))).toEqual({ source: "tiktok" });
    expect(parseAttributionCookie("not json")).toBeNull();
  });

  it("labels a source for the reports", () => {
    expect(attributionLabel({ source: "google", medium: "cpc" })).toBe("google / cpc");
    expect(attributionLabel(null)).toBe("Direct");
  });
});

describe("Google Analytics cookies", () => {
  it("reads the client and session ids", () => {
    expect(gaClientIdFromCookie("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(gaClientIdFromCookie("nonsense")).toBeNull();
    expect(gaSessionIdFromCookie("GS1.1.1700000123.3.1.1700000200.0.0.0")).toBe("1700000123");
    expect(gaSessionIdFromCookie("GS2.1.s1700000123$o3$g1$t1700000200")).toBe("1700000123");
  });
});
