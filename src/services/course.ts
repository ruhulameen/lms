import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { publiclyVisibleWhere } from "@/lib/content-status";
import {
  averageRating,
  discountPercent,
  formatCourseDuration,
  secondsToMinutes,
  type CourseLevelValue,
  type LessonTypeValue,
} from "@/lib/course";
import { publicUrl } from "@/lib/storage";
import { getSeo } from "@/services/seo";

// Public catalogue: only publicly visible courses (published, or scheduled and
// due), read through here by the site and the cart. Like the blog, pages are
// rendered per request, so a publish or a schedule passing shows up at once.
// Counts are real: students are enrolments that are not cancelled, reviews are
// the approved ones.

export const COURSE_PAGE_SIZE = 10;
const FEATURED_LIMIT = 8;
const RECOMMENDED_LIMIT = 5;

export type Course = {
  id: number;
  slug: string;
  title: string;
  // Chosen thumbnail; see courseImageSrc() in src/lib/course.ts for the fallback.
  imageUrl: string | null;
  externalImageId: string | null;
  category: string;
  categorySlug: string | null;
  summary?: string;
  // Approved reviews, and their average (null when there are none).
  reviews: number;
  rating: number | null;
  students: number;
  duration?: string;
  price: number;
  oldPrice?: number;
  badge?: string;
};

export type Deal = Course & { discount: string };

const UNCATEGORISED = "General";

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  price: true,
  compareAtPrice: true,
  badge: true,
  durationMinutes: true,
  externalImageId: true,
  thumbnail: { select: { key: true, kind: true } },
  category: { select: { name: true, slug: true } },
  _count: { select: { enrolments: { where: { status: { not: "CANCELLED" } } } } },
} satisfies Prisma.CourseSelect;

type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

type RatingStats = Map<number, { count: number; average: number | null }>;

async function ratingStats(courseIds: number[]): Promise<RatingStats> {
  if (courseIds.length === 0) return new Map();
  const groups = await db.courseReview.groupBy({
    by: ["courseId"],
    where: { courseId: { in: courseIds }, status: "APPROVED" },
    _count: { _all: true },
    _sum: { rating: true },
  });
  return new Map(
    groups.map((g) => [
      g.courseId,
      { count: g._count._all, average: averageRating(g._sum.rating ?? 0, g._count._all) },
    ]),
  );
}

function toCourse(row: CourseRow, stats: RatingStats): Course {
  const rating = stats.get(row.id);
  const price = Number(row.price);
  const compareAt = row.compareAtPrice === null ? null : Number(row.compareAtPrice);
  const duration = formatCourseDuration(row.durationMinutes);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.thumbnail?.kind === "IMAGE" ? publicUrl(row.thumbnail.key) : null,
    externalImageId: row.externalImageId,
    category: row.category?.name ?? UNCATEGORISED,
    categorySlug: row.category?.slug ?? null,
    summary: row.subtitle ?? undefined,
    reviews: rating?.count ?? 0,
    rating: rating?.average ?? null,
    students: row._count.enrolments,
    duration: duration ?? undefined,
    price,
    oldPrice: compareAt !== null && compareAt > price ? compareAt : undefined,
    badge: row.badge ?? undefined,
  };
}

async function toCourses(rows: CourseRow[]) {
  const stats = await ratingStats(rows.map((r) => r.id));
  return rows.map((row) => toCourse(row, stats));
}

const visible = () => publiclyVisibleWhere(new Date());

export type CourseListFilters = {
  search?: string;
  // Category slug.
  category?: string;
  free?: boolean;
  page?: number;
  pageSize?: number;
};

// Newest first. Returns one page and the total across all pages.
export async function getCourses(filters: CourseListFilters = {}) {
  const search = filters.search?.trim();
  const pageSize = filters.pageSize ?? COURSE_PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.CourseWhereInput = {
    AND: [
      visible(),
      filters.category ? { category: { slug: filters.category } } : {},
      filters.free === undefined ? {} : { price: filters.free ? 0 : { gt: 0 } },
      search
        ? { OR: [{ title: { contains: search } }, { subtitle: { contains: search } }, { category: { name: { contains: search } } }] }
        : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: courseSelect,
    }),
    db.course.count({ where }),
  ]);
  return { courses: await toCourses(rows), total, page, pageSize };
}

// Categories that have at least one visible course, with how many.
export async function getCourseCategories() {
  const rows = await db.courseCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, _count: { select: { courses: { where: visible() } } } },
  });
  return rows
    .filter((c) => c._count.courses > 0)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, courseCount: c._count.courses }));
}

// One course in the card shape; also used by the cart.
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const row = await db.course.findFirst({ where: { slug, ...visible() }, select: courseSelect });
  if (!row) return null;
  return (await toCourses([row]))[0];
}

// Cards for specific courses whatever their status: a learner keeps seeing a
// course they enrolled in or earned a certificate for after it is unpublished.
// Order follows `ids`; unknown ids are skipped.
export async function getCoursesByIds(ids: number[]): Promise<Course[]> {
  if (ids.length === 0) return [];
  const rows = await db.course.findMany({ where: { id: { in: ids } }, select: courseSelect });
  const cards = new Map((await toCourses(rows)).map((c) => [c.id, c]));
  return ids.flatMap((id) => cards.get(id) ?? []);
}

// Cards of public courses the given ids do not include, for "recommended".
export async function getCatalogueExcluding(excludeIds: number[], limit: number) {
  const rows = await db.course.findMany({
    where: { AND: [visible(), excludeIds.length ? { id: { notIn: excludeIds } } : {}] },
    orderBy: [{ enrolments: { _count: "desc" } }, { publishedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: courseSelect,
  });
  return toCourses(rows);
}

export async function getFeaturedCourses() {
  const rows = await db.course.findMany({
    where: { featured: true, ...visible() },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: FEATURED_LIMIT,
    select: courseSelect,
  });
  return toCourses(rows);
}

// Paid courses with the most learners, newest breaking ties.
export async function getRecommendedCourses() {
  const rows = await db.course.findMany({
    where: { price: { gt: 0 }, ...visible() },
    orderBy: [{ enrolments: { _count: "desc" } }, { publishedAt: "desc" }, { id: "desc" }],
    take: RECOMMENDED_LIMIT,
    select: courseSelect,
  });
  return toCourses(rows);
}

export async function getFreeCourses() {
  const rows = await db.course.findMany({
    where: { price: 0, ...visible() },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: courseSelect,
  });
  return toCourses(rows);
}

// Courses whose "was" price is at least `discount` percent off (and, for "80",
// under 90 percent off), so each course shows in one band.
export async function getDeals(discount: "90" | "80"): Promise<Deal[]> {
  const rows = await db.course.findMany({
    where: { price: { gt: 0 }, compareAtPrice: { not: null }, ...visible() },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: courseSelect,
  });
  const floor = Number(discount);
  const ceiling = discount === "90" ? Infinity : 90;
  return (await toCourses(rows)).flatMap((course) => {
    const percent = discountPercent(course.price, course.oldPrice) ?? 0;
    return percent >= floor && percent < ceiling ? { ...course, discount } : [];
  });
}

// Same category first, then the newest of the rest; never the course itself.
export async function getRelatedCourses(course: { id: number; categorySlug: string | null }, limit = 3) {
  const query = (where: Prisma.CourseWhereInput, take: number) =>
    db.course.findMany({
      where: { AND: [{ id: { not: course.id } }, visible(), where] },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take,
      select: courseSelect,
    });
  const same = course.categorySlug ? await query({ category: { slug: course.categorySlug } }, limit) : [];
  const rest =
    same.length < limit
      ? await query({ id: { notIn: same.map((r) => r.id) } }, limit - same.length)
      : [];
  return toCourses([...same, ...rest]);
}

export type CurriculumLesson = {
  id: number;
  title: string;
  slug: string;
  type: LessonTypeValue;
  durationSeconds: number | null;
  isFreePreview: boolean;
};

export type CurriculumModule = {
  id: number;
  title: string;
  description: string | null;
  lessons: CurriculumLesson[];
};

export type CourseReviewItem = {
  id: number;
  name: string;
  image: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  date: Date;
};

export type CourseDetail = Course & {
  subtitle: string | null;
  shortDescription: string | null;
  // Rich text document, or null when none was written.
  description: unknown;
  level: CourseLevelValue;
  language: string;
  // Shown length: the set duration, else the sum of lesson durations.
  durationMinutes: number | null;
  lessonCount: number;
  hasIntroVideo: boolean;
  instructor: { name: string; image: string | null; bio: string | null } | null;
  tags: { name: string; slug: string }[];
  modules: CurriculumModule[];
  seo: { title: string | null; metaDescription: string | null; canonicalUrl: string | null; noindex: boolean; socialImageUrl: string | null } | null;
};

const REVIEW_LIMIT = 10;

// The course page: the card data plus curriculum, instructor and tags. Only
// published lessons are listed.
export async function getCourseDetail(slug: string): Promise<CourseDetail | null> {
  const row = await db.course.findFirst({
    where: { slug, ...visible() },
    select: {
      ...courseSelect,
      shortDescription: true,
      description: true,
      level: true,
      language: true,
      introVideoKey: true,
      instructor: { select: { name: true, image: true, bio: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      modules: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          lessons: {
            where: { published: true },
            orderBy: { position: "asc" },
            select: { id: true, title: true, slug: true, type: true, durationSeconds: true, isFreePreview: true },
          },
        },
      },
    },
  });
  if (!row) return null;

  const [course] = await toCourses([row]);
  const seo = await getSeo("COURSE", row.id);
  const socialImage = seo?.socialImageId
    ? await db.media.findFirst({ where: { id: seo.socialImageId, kind: "IMAGE" }, select: { key: true } })
    : null;

  const lessons = row.modules.flatMap((m) => m.lessons);
  const lessonSeconds = lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
  const durationMinutes = row.durationMinutes ?? (lessonSeconds > 0 ? secondsToMinutes(lessonSeconds) : null);

  return {
    ...course,
    duration: formatCourseDuration(durationMinutes) ?? undefined,
    subtitle: row.subtitle,
    shortDescription: row.shortDescription,
    description: row.description,
    level: row.level,
    language: row.language,
    durationMinutes,
    lessonCount: lessons.length,
    hasIntroVideo: Boolean(row.introVideoKey),
    instructor: row.instructor,
    tags: row.tags.map((t) => t.tag).sort((a, b) => a.name.localeCompare(b.name)),
    modules: row.modules,
    seo: seo
      ? {
          title: seo.title,
          metaDescription: seo.metaDescription,
          canonicalUrl: seo.canonicalUrl,
          noindex: seo.noindex,
          socialImageUrl: socialImage ? publicUrl(socialImage.key) : null,
        }
      : null,
  };
}

// Newest approved reviews of a course.
export async function getApprovedCourseReviews(courseId: number, limit = REVIEW_LIMIT): Promise<CourseReviewItem[]> {
  const rows = await db.courseReview.findMany({
    where: { courseId, status: "APPROVED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.user.name,
    image: r.user.image,
    rating: r.rating,
    title: r.title,
    body: r.body,
    date: r.createdAt,
  }));
}
