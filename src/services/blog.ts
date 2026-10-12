import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatReadTime, publicDate, resolveExcerpt } from "@/lib/blog-post";
import { publiclyVisibleWhere } from "@/lib/content-status";
import { readingTimeMinutes } from "@/lib/rich-text";
import { publicUrl } from "@/lib/storage";
import { getSeo } from "@/services/seo";

// Public blog: only publicly visible posts (published, or scheduled and due).
// The pages are rendered per request (the site header reads the session), so a
// publish or a schedule passing shows up without any revalidation.

export const BLOG_PAGE_SIZE = 6;
const FEATURED_LIMIT = 5;

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: unknown;
  category: { name: string; slug: string } | null;
  // Null until a featured image is chosen (or while storage is not configured).
  image: { url: string; alt: string } | null;
  readTime: string;
  date: Date;
  featured: boolean;
  author: { name: string; image: string | null; bio: string | null } | null;
  tags: { name: string; slug: string }[];
};

export const postSelect = {
  id: true,
  slug: true,
  title: true,
  body: true,
  excerpt: true,
  featured: true,
  publishedAt: true,
  publishAt: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
  author: { select: { name: true, image: true, bio: true } },
  featuredImage: { select: { key: true, altText: true, title: true, kind: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} satisfies Prisma.BlogPostSelect;

type PostRow = Prisma.BlogPostGetPayload<{ select: typeof postSelect }>;

export function toBlogPost(row: PostRow): BlogPost {
  const imageUrl = row.featuredImage?.kind === "IMAGE" ? publicUrl(row.featuredImage.key) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: resolveExcerpt(row.excerpt, row.body),
    body: row.body,
    category: row.category,
    image: imageUrl ? { url: imageUrl, alt: row.featuredImage?.altText || row.featuredImage?.title || "" } : null,
    readTime: formatReadTime(readingTimeMinutes(row.body)),
    date: publicDate(row),
    featured: row.featured,
    author: row.author,
    tags: row.tags.map((t) => t.tag).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Newest first by the date shown on the site. The date is publishedAt or, for
// a scheduled post that has come due, publishAt, which a single SQL ORDER BY
// cannot express, so the ids are ordered here and only one page is loaded in full.
async function visiblePage(extra: Prisma.BlogPostWhereInput, page: number, pageSize: number) {
  const where: Prisma.BlogPostWhereInput = { AND: [publiclyVisibleWhere(new Date()), extra] };
  const ids = await db.blogPost.findMany({
    where,
    select: { id: true, publishedAt: true, publishAt: true, createdAt: true },
  });
  const ordered = ids
    .map((row) => ({ id: row.id, time: publicDate(row).getTime() }))
    .sort((a, b) => b.time - a.time || b.id - a.id);
  const pageIds = ordered.slice((page - 1) * pageSize, page * pageSize).map((row) => row.id);
  const rows = await db.blogPost.findMany({ where: { id: { in: pageIds } }, select: postSelect });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const posts = pageIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toBlogPost(row)] : [];
  });
  return { posts, total: ordered.length };
}

export async function getFeaturedPosts() {
  return (await visiblePage({ featured: true }, 1, FEATURED_LIMIT)).posts;
}

export type LatestFilters = { page?: number; category?: string; tag?: string };

// The list below the slider. Without a filter the featured posts are left out
// (they are in the slider); with a category or tag filter every match is listed.
export async function getLatestPosts(filters: LatestFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const filtered = Boolean(filters.category || filters.tag);
  const extra: Prisma.BlogPostWhereInput = {
    featured: filtered ? undefined : false,
    category: filters.category ? { slug: filters.category } : undefined,
    tags: filters.tag ? { some: { tag: { slug: filters.tag } } } : undefined,
  };
  const { posts, total } = await visiblePage(extra, page, BLOG_PAGE_SIZE);
  return { posts, total, page, pageSize: BLOG_PAGE_SIZE };
}

export const getPostBySlug = cache(async (slug: string) => {
  const row = await db.blogPost.findFirst({
    where: { AND: [{ slug }, publiclyVisibleWhere(new Date())] },
    select: postSelect,
  });
  return row ? toBlogPost(row) : null;
});

// Same category first, then the newest of the rest.
export async function getRelatedPosts(post: Pick<BlogPost, "id" | "category">, limit = 3) {
  const notThis: Prisma.BlogPostWhereInput = { id: { not: post.id } };
  const same = post.category
    ? (await visiblePage({ ...notThis, category: { slug: post.category.slug } }, 1, limit)).posts
    : [];
  if (same.length >= limit) return same;
  const taken = [post.id, ...same.map((p) => p.id)];
  const rest = await visiblePage({ id: { notIn: taken } }, 1, limit - same.length);
  return [...same, ...rest.posts];
}

// Categories and tags that have at least one public post, for the filter bar.
export async function getBlogFilters() {
  const visible = publiclyVisibleWhere(new Date());
  const [categories, tags] = await Promise.all([
    db.blogCategory.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true, _count: { select: { posts: { where: visible } } } },
    }),
    db.blogTag.findMany({
      orderBy: { name: "asc" },
      select: { name: true, slug: true, _count: { select: { posts: { where: { post: visible } } } } },
    }),
  ]);
  return {
    categories: categories.filter((c) => c._count.posts > 0).map(({ name, slug }) => ({ name, slug })),
    tags: tags.filter((t) => t._count.posts > 0).map(({ name, slug }) => ({ name, slug })),
  };
}

// Raw SEO row plus resolved image URLs, for the article's metadata.
export async function getPostMetadataSource(postId: number) {
  const seo = await getSeo("POST", postId);
  const [social, featured] = await Promise.all([
    seo?.socialImageId ? db.media.findFirst({ where: { id: seo.socialImageId, uploadStatus: "READY" }, select: { key: true } }) : null,
    db.blogPost.findUnique({ where: { id: postId }, select: { featuredImage: { select: { key: true, kind: true } } } }),
  ]);
  return {
    seo,
    socialImageUrl: social ? publicUrl(social.key) : null,
    featuredImageUrl: featured?.featuredImage?.kind === "IMAGE" ? publicUrl(featured.featuredImage.key) : null,
  };
}
