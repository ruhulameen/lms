import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/services/activity";

// Moderating learner reviews of courses (review.moderate). Learners write
// them in src/services/review.ts; a new or edited review starts PENDING and
// only APPROVED ones are shown on the site.

export type ReviewStatusValue = "PENDING" | "APPROVED" | "REJECTED";
export const REVIEW_PAGE_SIZE = 10;

export async function countReviewsByStatus(): Promise<Record<ReviewStatusValue, number>> {
  const groups = await db.courseReview.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (status: ReviewStatusValue) => groups.find((g) => g.status === status)?._count._all ?? 0;
  return { PENDING: count("PENDING"), APPROVED: count("APPROVED"), REJECTED: count("REJECTED") };
}

export async function listReviews(filters: { status: ReviewStatusValue; search?: string; courseId?: number; page?: number }) {
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();
  const where: Prisma.CourseReviewWhereInput = {
    status: filters.status,
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search } },
            { body: { contains: search } },
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
            { course: { title: { contains: search } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.courseReview.findMany({
      where,
      orderBy: filters.status === "PENDING" ? [{ updatedAt: "asc" }, { id: "asc" }] : [{ moderatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * REVIEW_PAGE_SIZE,
      take: REVIEW_PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        moderatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, slug: true } },
        moderatedBy: { select: { name: true } },
      },
    }),
    db.courseReview.count({ where }),
  ]);
  return { rows, total, page, pageSize: REVIEW_PAGE_SIZE };
}

export type ModerationResult = { ok: true; message: string; courseSlug: string } | { ok: false; error: string };

export async function moderateReview(reviewId: number, status: "APPROVED" | "REJECTED", actorId: number): Promise<ModerationResult> {
  const review = await db.courseReview.findUnique({
    where: { id: reviewId },
    select: { id: true, status: true, rating: true, user: { select: { name: true } }, course: { select: { title: true, slug: true } } },
  });
  if (!review) return { ok: false, error: "This review no longer exists." };
  if (review.status !== status) {
    await db.courseReview.update({ where: { id: reviewId }, data: { status, moderatedById: actorId, moderatedAt: new Date() } });
    await logActivity({
      userId: actorId,
      action: status === "APPROVED" ? "review.approve" : "review.reject",
      entity: "course-review",
      entityId: reviewId,
      details: { learner: review.user.name, course: review.course.title, rating: review.rating, from: review.status },
    });
  }
  return { ok: true, message: status === "APPROVED" ? "Review approved." : "Review rejected.", courseSlug: review.course.slug };
}

export async function deleteReview(reviewId: number, actorId: number): Promise<ModerationResult> {
  const review = await db.courseReview.findUnique({
    where: { id: reviewId },
    select: { id: true, status: true, rating: true, user: { select: { name: true } }, course: { select: { title: true, slug: true } } },
  });
  if (!review) return { ok: false, error: "This review no longer exists." };
  await db.courseReview.delete({ where: { id: reviewId } });
  await logActivity({
    userId: actorId,
    action: "review.delete",
    entity: "course-review",
    entityId: reviewId,
    details: { learner: review.user.name, course: review.course.title, rating: review.rating, status: review.status },
  });
  return { ok: true, message: "Review deleted.", courseSlug: review.course.slug };
}
