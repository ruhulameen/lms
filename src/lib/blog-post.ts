import { z } from "zod";
import type { ContentStatusValue } from "@/lib/content-status";
import type { PostSnapshot } from "@/lib/revision-diff";
import { excerptFromDocument, richTextSchema } from "@/lib/rich-text";
import { validateSlug } from "@/lib/slug";

// Pure helpers for blog posts, shared by the admin actions, the public pages
// and the tests.

export const TITLE_MAX = 200;
export const EXCERPT_MAX = 500;
export const BIO_MAX = 1000;

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Choose a valid option.");

// The post fields of the editor form. Status, SEO and tags are parsed on their own.
export const postFieldsSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(TITLE_MAX, `Use at most ${TITLE_MAX} characters.`),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((value, ctx) => {
      const message = validateSlug(value);
      if (message) ctx.addIssue({ code: "custom", message });
    }),
  body: richTextSchema,
  excerpt: z
    .string()
    .trim()
    .max(EXCERPT_MAX, `Use at most ${EXCERPT_MAX} characters.`)
    .optional()
    .transform((v) => v || null),
  featuredImageId: optionalId,
  categoryId: optionalId,
  authorId: optionalId,
  featured: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

// Excerpt shown on cards and in meta tags: the written one, else the start of the body.
export function resolveExcerpt(excerpt: string | null | undefined, body: unknown, maxLength = 160) {
  const written = excerpt?.trim();
  return written || excerptFromDocument(body, maxLength);
}

// Public date of a post: when it went live, else its scheduled time.
export function publicDate(post: { publishedAt: Date | null; publishAt: Date | null; createdAt: Date }) {
  return post.publishedAt ?? post.publishAt ?? post.createdAt;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const formatPostDate = (date: Date) => dateFormatter.format(date);

export const formatReadTime = (minutes: number) => `${minutes} min read`;

export type PostMetadataInput = {
  title: string;
  slug: string;
  excerpt: string | null;
  body: unknown;
  seo: { title: string | null; metaDescription: string | null; canonicalUrl: string | null; noindex: boolean } | null;
  // Resolved image URLs (null when storage is not configured or nothing is set).
  socialImageUrl: string | null;
  featuredImageUrl: string | null;
};

// Fallback rules for an article's <head>: SEO row first, then the post itself.
export function postMetadataFields(post: PostMetadataInput) {
  const description = post.seo?.metaDescription?.trim() || resolveExcerpt(post.excerpt, post.body);
  return {
    title: post.seo?.title?.trim() || post.title,
    description: description || undefined,
    canonical: post.seo?.canonicalUrl?.trim() || `/blog/${post.slug}`,
    noindex: Boolean(post.seo?.noindex),
    image: post.socialImageUrl ?? post.featuredImageUrl ?? null,
  };
}

// Key-order independent, so a document read from the database compares equal
// to the same document coming back from the editor.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function snapshotsEqual(a: PostSnapshot, b: PostSnapshot) {
  const normal = (s: PostSnapshot) => ({ ...s, tagIds: [...s.tagIds].sort((x, y) => x - y) });
  return stableStringify(normal(a)) === stableStringify(normal(b));
}

// What restoring an old revision may write back: the slug only if no other
// post uses it, and category, tags and social image only if they still exist.
export function planRestore(
  snapshot: PostSnapshot,
  current: { slug: string },
  exists: {
    slugTaken: boolean;
    categoryIds: readonly number[];
    tagIds: readonly number[];
    mediaIds: readonly number[];
  },
) {
  const keepSlug = exists.slugTaken && snapshot.slug !== current.slug;
  const categoryOk = snapshot.categoryId !== null && exists.categoryIds.includes(snapshot.categoryId);
  const tagIds = snapshot.tagIds.filter((id) => exists.tagIds.includes(id));
  const socialOk = snapshot.seo?.socialImageId != null && exists.mediaIds.includes(snapshot.seo.socialImageId);
  return {
    title: snapshot.title,
    slug: keepSlug ? current.slug : snapshot.slug,
    excerpt: snapshot.excerpt,
    body: snapshot.body,
    categoryId: categoryOk ? snapshot.categoryId : null,
    tagIds,
    seo: snapshot.seo ? { ...snapshot.seo, socialImageId: socialOk ? snapshot.seo.socialImageId : null } : null,
    skipped: {
      slug: keepSlug,
      category: snapshot.categoryId !== null && !categoryOk,
      tags: snapshot.tagIds.length - tagIds.length,
    },
  };
}

// The activity action for a status change, or null when there is none
// (for example pending review back to draft is just an update).
export function statusActivity(from: ContentStatusValue | null, to: ContentStatusValue) {
  if (from === to) return null;
  switch (to) {
    case "PENDING_REVIEW":
      return "post.submit-for-review";
    case "PUBLISHED":
      return "post.publish";
    case "SCHEDULED":
      return "post.schedule";
    case "ARCHIVED":
      return "post.archive";
    case "DRAFT":
      return from === "PUBLISHED" || from === "SCHEDULED" ? "post.unpublish" : null;
  }
}
