import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const TAXONOMY_PAGE_SIZE = 15;
export const TAXONOMY_SORT_KEYS = ["name", "slug", "posts"] as const;
export type TaxonomySortKey = (typeof TAXONOMY_SORT_KEYS)[number];

export type TaxonomyFilters = {
  search?: string;
  sort: TaxonomySortKey;
  order: "asc" | "desc";
  page: number;
};

// Admin data: call only after requirePermission("post.view").
export async function listBlogCategories(filters: TaxonomyFilters) {
  const search = filters.search?.trim();
  const where: Prisma.BlogCategoryWhereInput = {
    OR: search ? [{ name: { contains: search } }, { slug: { contains: search } }] : undefined,
  };
  const dir = filters.order;
  const [rows, total] = await Promise.all([
    db.blogCategory.findMany({
      where,
      orderBy: [filters.sort === "posts" ? { posts: { _count: dir } } : { [filters.sort]: dir }, { id: "asc" }],
      skip: (filters.page - 1) * TAXONOMY_PAGE_SIZE,
      take: TAXONOMY_PAGE_SIZE,
      select: { id: true, name: true, slug: true, description: true, _count: { select: { posts: true } } },
    }),
    db.blogCategory.count({ where }),
  ]);
  return { rows, total, page: filters.page, pageSize: TAXONOMY_PAGE_SIZE };
}

export async function listBlogTags(filters: TaxonomyFilters) {
  const search = filters.search?.trim();
  const where: Prisma.BlogTagWhereInput = {
    OR: search ? [{ name: { contains: search } }, { slug: { contains: search } }] : undefined,
  };
  const dir = filters.order;
  const [rows, total] = await Promise.all([
    db.blogTag.findMany({
      where,
      orderBy: [filters.sort === "posts" ? { posts: { _count: dir } } : { [filters.sort]: dir }, { id: "asc" }],
      skip: (filters.page - 1) * TAXONOMY_PAGE_SIZE,
      take: TAXONOMY_PAGE_SIZE,
      select: { id: true, name: true, slug: true, _count: { select: { posts: true } } },
    }),
    db.blogTag.count({ where }),
  ]);
  return { rows, total, page: filters.page, pageSize: TAXONOMY_PAGE_SIZE };
}

export async function listCategoryOptions() {
  return db.blogCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function listTagOptions() {
  return db.blogTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
