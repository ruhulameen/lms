import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const COURSE_TAXONOMY_PAGE_SIZE = 15;
export const COURSE_TAXONOMY_SORT_KEYS = ["name", "slug", "courses"] as const;
export type CourseTaxonomySortKey = (typeof COURSE_TAXONOMY_SORT_KEYS)[number];

export type CourseTaxonomyFilters = {
  search?: string;
  sort: CourseTaxonomySortKey;
  order: "asc" | "desc";
  page: number;
};

// Admin data: call only after requirePermission("course.view").
export async function listCourseCategories(filters: CourseTaxonomyFilters) {
  const search = filters.search?.trim();
  const where: Prisma.CourseCategoryWhereInput = {
    OR: search ? [{ name: { contains: search } }, { slug: { contains: search } }] : undefined,
  };
  const dir = filters.order;
  const [rows, total] = await Promise.all([
    db.courseCategory.findMany({
      where,
      orderBy: [filters.sort === "courses" ? { courses: { _count: dir } } : { [filters.sort]: dir }, { id: "asc" }],
      skip: (filters.page - 1) * COURSE_TAXONOMY_PAGE_SIZE,
      take: COURSE_TAXONOMY_PAGE_SIZE,
      select: { id: true, name: true, slug: true, description: true, _count: { select: { courses: true } } },
    }),
    db.courseCategory.count({ where }),
  ]);
  return { rows, total, page: filters.page, pageSize: COURSE_TAXONOMY_PAGE_SIZE };
}

export async function listCourseTags(filters: CourseTaxonomyFilters) {
  const search = filters.search?.trim();
  const where: Prisma.CourseTagWhereInput = {
    OR: search ? [{ name: { contains: search } }, { slug: { contains: search } }] : undefined,
  };
  const dir = filters.order;
  const [rows, total] = await Promise.all([
    db.courseTag.findMany({
      where,
      orderBy: [filters.sort === "courses" ? { courses: { _count: dir } } : { [filters.sort]: dir }, { id: "asc" }],
      skip: (filters.page - 1) * COURSE_TAXONOMY_PAGE_SIZE,
      take: COURSE_TAXONOMY_PAGE_SIZE,
      select: { id: true, name: true, slug: true, _count: { select: { courses: true } } },
    }),
    db.courseTag.count({ where }),
  ]);
  return { rows, total, page: filters.page, pageSize: COURSE_TAXONOMY_PAGE_SIZE };
}
