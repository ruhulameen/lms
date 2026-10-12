import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ContentStatusValue } from "@/lib/content-status";
import { getMediaSummary } from "@/services/media";
import { postSelect, toBlogPost } from "@/services/blog";
import { getSeo } from "@/services/seo";

export const POST_PAGE_SIZE = 15;

export const POST_SORT_KEYS = ["title", "status", "category", "author", "date", "updated"] as const;
export type PostSortKey = (typeof POST_SORT_KEYS)[number];

export type PostListFilters = {
  search?: string;
  status?: ContentStatusValue;
  categoryId?: number;
  authorId?: number;
  sort: PostSortKey;
  order: "asc" | "desc";
  page: number;
};

// Admin data: call only after requirePermission("post.view").
export async function listPosts(filters: PostListFilters) {
  const search = filters.search?.trim();
  const where: Prisma.BlogPostWhereInput = {
    status: filters.status,
    categoryId: filters.categoryId,
    authorId: filters.authorId,
    OR: search ? [{ title: { contains: search } }, { slug: { contains: search } }] : undefined,
  };
  const dir = filters.order;
  const orderBy: Prisma.BlogPostOrderByWithRelationInput[] = [
    filters.sort === "category"
      ? { category: { name: dir } }
      : filters.sort === "author"
        ? { author: { name: dir } }
        : filters.sort === "date"
          ? { publishedAt: dir }
          : filters.sort === "updated"
            ? { updatedAt: dir }
            : { [filters.sort]: dir },
    { id: "desc" },
  ];
  const [rows, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * POST_PAGE_SIZE,
      take: POST_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        featured: true,
        publishedAt: true,
        publishAt: true,
        updatedAt: true,
        category: { select: { name: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    db.blogPost.count({ where }),
  ]);
  return { rows, total, page: filters.page, pageSize: POST_PAGE_SIZE };
}

// Admin data: call only after requirePermission("post.view").
export async function getPostForEdit(id: number) {
  const post = await db.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      body: true,
      excerpt: true,
      featuredImageId: true,
      categoryId: true,
      authorId: true,
      featured: true,
      status: true,
      publishAt: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      tags: { select: { tagId: true } },
    },
  });
  if (!post) return null;
  const seo = await getSeo("POST", id);
  const [featuredImage, socialImage] = await Promise.all([
    getMediaSummary(post.featuredImageId),
    getMediaSummary(seo?.socialImageId),
  ]);
  return { ...post, tagIds: post.tags.map((t) => t.tagId), seo, featuredImage, socialImage };
}

export async function getPostHeading(id: number) {
  return db.blogPost.findUnique({ where: { id }, select: { id: true, title: true, slug: true, status: true } });
}

// The post as the public article page would receive it, whatever its status.
export async function getPostPreview(id: number) {
  const row = await db.blogPost.findUnique({ where: { id }, select: { ...postSelect, status: true } });
  return row ? { post: toBlogPost(row), status: row.status } : null;
}

// Users who may write posts; `include` keeps a post's current author listed
// even if their role has changed since.
export async function listAuthorOptions(include?: number | null) {
  return db.user.findMany({
    where: {
      OR: [
        {
          status: "ACTIVE",
          role: {
            OR: [
              { name: "admin" },
              { permissions: { some: { permission: { key: { in: ["post.create", "post.edit", "post.publish"] } } } } },
            ],
          },
        },
        ...(include ? [{ id: include }] : []),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// Authors for the list filter: everyone who has written a post.
export async function listPostAuthorFilter() {
  return db.user.findMany({
    where: { blogPosts: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function isValidAuthor(userId: number) {
  const options = await db.user.findFirst({
    where: {
      id: userId,
      status: "ACTIVE",
      role: {
        OR: [
          { name: "admin" },
          { permissions: { some: { permission: { key: { in: ["post.create", "post.edit", "post.publish"] } } } } },
        ],
      },
    },
    select: { id: true },
  });
  return Boolean(options);
}
