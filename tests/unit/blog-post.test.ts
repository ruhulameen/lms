import { describe, expect, it } from "vitest";
import {
  formatPostDate,
  planRestore,
  postMetadataFields,
  publicDate,
  resolveExcerpt,
  snapshotsEqual,
  statusActivity,
} from "@/lib/blog-post";
import type { PostSnapshot } from "@/lib/revision-diff";

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("resolveExcerpt", () => {
  it("prefers the written excerpt", () => {
    expect(resolveExcerpt("  Written  ", doc("Body"))).toBe("Written");
  });
  it("falls back to the start of the body", () => {
    expect(resolveExcerpt(null, doc("a ".repeat(200)), 20).length).toBeLessThanOrEqual(20);
    expect(resolveExcerpt("", doc("Short body"))).toBe("Short body");
  });
});

describe("publicDate", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  it("uses publishedAt, then publishAt, then createdAt", () => {
    const publishedAt = new Date("2026-02-01T00:00:00Z");
    const publishAt = new Date("2026-03-01T00:00:00Z");
    expect(publicDate({ publishedAt, publishAt, createdAt })).toBe(publishedAt);
    expect(publicDate({ publishedAt: null, publishAt, createdAt })).toBe(publishAt);
    expect(publicDate({ publishedAt: null, publishAt: null, createdAt })).toBe(createdAt);
  });
  it("formats in UTC", () => {
    expect(formatPostDate(new Date("2025-09-12T23:30:00Z"))).toMatch(/^12 Sep/);
  });
});

describe("postMetadataFields", () => {
  const base = {
    title: "Post title",
    slug: "post-title",
    excerpt: null,
    body: doc("Body text"),
    seo: null,
    socialImageUrl: null,
    featuredImageUrl: null,
  };
  it("falls back to the post when there is no SEO row", () => {
    expect(postMetadataFields(base)).toEqual({
      title: "Post title",
      description: "Body text",
      canonical: "/blog/post-title",
      noindex: false,
      image: null,
    });
  });
  it("uses the SEO row, then the social image before the featured image", () => {
    const meta = postMetadataFields({
      ...base,
      excerpt: "Excerpt",
      seo: { title: "SEO title", metaDescription: "Meta", canonicalUrl: "https://example.com/x", noindex: true },
      socialImageUrl: "https://cdn/social.jpg",
      featuredImageUrl: "https://cdn/featured.jpg",
    });
    expect(meta).toMatchObject({ title: "SEO title", description: "Meta", canonical: "https://example.com/x", noindex: true, image: "https://cdn/social.jpg" });
    expect(postMetadataFields({ ...base, excerpt: "Excerpt", featuredImageUrl: "https://cdn/f.jpg" })).toMatchObject({
      description: "Excerpt",
      image: "https://cdn/f.jpg",
    });
  });
});

describe("planRestore", () => {
  const snapshot: PostSnapshot = {
    title: "Old",
    slug: "old-slug",
    excerpt: null,
    body: doc("old"),
    seo: { title: null, metaDescription: "m", canonicalUrl: null, noindex: false, socialImageId: 9 },
    categoryId: 3,
    tagIds: [1, 2],
  };
  it("restores everything that still exists", () => {
    const plan = planRestore(snapshot, { slug: "new-slug" }, { slugTaken: false, categoryIds: [3], tagIds: [1, 2], mediaIds: [9] });
    expect(plan).toMatchObject({ slug: "old-slug", categoryId: 3, tagIds: [1, 2] });
    expect(plan.seo?.socialImageId).toBe(9);
  });
  it("keeps the current slug when another post took the old one, and drops missing references", () => {
    const plan = planRestore(snapshot, { slug: "new-slug" }, { slugTaken: true, categoryIds: [], tagIds: [2], mediaIds: [] });
    expect(plan).toMatchObject({ slug: "new-slug", categoryId: null, tagIds: [2] });
    expect(plan.seo?.socialImageId).toBeNull();
    expect(plan.skipped).toEqual({ slug: true, category: true, tags: 1 });
  });
});

describe("snapshotsEqual", () => {
  const a: PostSnapshot = { title: "t", slug: "s", excerpt: null, body: { b: 1, a: 2 }, seo: null, categoryId: null, tagIds: [2, 1] };
  it("ignores key and tag order", () => {
    expect(snapshotsEqual(a, { ...a, body: { a: 2, b: 1 }, tagIds: [1, 2] })).toBe(true);
    expect(snapshotsEqual(a, { ...a, title: "other" })).toBe(false);
  });
});

describe("statusActivity", () => {
  it("names the action for a status change", () => {
    expect(statusActivity("DRAFT", "PENDING_REVIEW")).toBe("post.submit-for-review");
    expect(statusActivity("PENDING_REVIEW", "PUBLISHED")).toBe("post.publish");
    expect(statusActivity("PUBLISHED", "DRAFT")).toBe("post.unpublish");
    expect(statusActivity("PENDING_REVIEW", "DRAFT")).toBeNull();
    expect(statusActivity("DRAFT", "DRAFT")).toBeNull();
  });
});
