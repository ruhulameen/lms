import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { publiclyVisibleWhere } from "@/lib/content-status";

export const AUTHOR_PAGE_SIZE = 15;
export const AUTHOR_SORT_KEYS = ["name", "posts"] as const;
export type AuthorSortKey = (typeof AUTHOR_SORT_KEYS)[number];

export type AuthorFilters = {
  search?: string;
  sort: AuthorSortKey;
  order: "asc" | "desc";
  page: number;
};

// Authors are users with at least one post; the bio lives on the user.
// Admin data: call only after requirePermission("post.view").
export async function listAuthors(filters: AuthorFilters) {
  const search = filters.search?.trim();
  const where: Prisma.UserWhereInput = {
    blogPosts: { some: {} },
    OR: search ? [{ name: { contains: search } }, { email: { contains: search } }] : undefined,
  };
  const dir = filters.order;
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [filters.sort === "posts" ? { blogPosts: { _count: dir } } : { name: dir }, { id: "asc" }],
      skip: (filters.page - 1) * AUTHOR_PAGE_SIZE,
      take: AUTHOR_PAGE_SIZE,
      select: { id: true, name: true, bio: true, _count: { select: { blogPosts: true } } },
    }),
    db.user.count({ where }),
  ]);
  const published = await db.blogPost.groupBy({
    by: ["authorId"],
    where: { authorId: { in: users.map((u) => u.id) }, ...publiclyVisibleWhere(new Date()) },
    _count: { _all: true },
  });
  const publishedBy = new Map(published.map((p) => [p.authorId, p._count._all]));
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    bio: u.bio,
    total: u._count.blogPosts,
    published: publishedBy.get(u.id) ?? 0,
  }));
  return { rows, total, page: filters.page, pageSize: AUTHOR_PAGE_SIZE };
}
