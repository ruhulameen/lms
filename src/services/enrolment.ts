import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { publiclyVisibleWhere } from "@/lib/content-status";
import { hasLearnerAccess } from "@/lib/learning";
import { logActivity } from "@/services/activity";
import type { CurrentUser } from "@/services/user";

// Enrolment: who is taking which course. A learner joins a free course
// themselves; paid courses are assigned by an admin (stage 3) and, later, by
// orders. Lesson access follows the enrolment (see lesson-access.ts).

export type EnrolmentState = {
  id: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  progressPercent: number;
  lastLessonId: number | null;
};

// The learner's enrolment in a course plus the lessons they have finished, or
// nulls when signed out or not enrolled.
export async function getLearnerCourseState(userId: number | null, courseId: number) {
  if (userId === null) return { enrolment: null, completedLessonIds: [] as number[] };
  const enrolment = await db.enrolment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, status: true, progressPercent: true, lastLessonId: true },
  });
  if (!enrolment) return { enrolment: null, completedLessonIds: [] as number[] };
  const done = await db.lessonProgress.findMany({
    where: { enrolmentId: enrolment.id, completedAt: { not: null }, lesson: { published: true } },
    select: { lessonId: true },
  });
  return { enrolment: enrolment as EnrolmentState, completedLessonIds: done.map((d) => d.lessonId) };
}

export const learnerCanLearn = (enrolment: EnrolmentState | null) =>
  Boolean(enrolment && hasLearnerAccess(enrolment.status));

export type EnrolResult =
  | { ok: true; courseSlug: string; alreadyEnrolled: boolean }
  | { ok: false; error: string };

// Self-enrolment in a free, publicly visible course.
export async function enrolInFreeCourse(user: CurrentUser, courseSlug: string): Promise<EnrolResult> {
  const course = await db.course.findFirst({
    where: { slug: courseSlug, price: 0, ...publiclyVisibleWhere(new Date()) },
    select: { id: true, slug: true, title: true },
  });
  if (!course) return { ok: false, error: "This course is not available to join for free." };

  const existing = await db.enrolment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { status: true },
  });
  if (existing) {
    if (hasLearnerAccess(existing.status)) return { ok: true, courseSlug: course.slug, alreadyEnrolled: true };
    return { ok: false, error: "Your enrolment in this course was cancelled. Contact support to rejoin." };
  }

  try {
    const enrolment = await db.enrolment.create({
      data: { userId: user.id, courseId: course.id, source: "FREE" },
      select: { id: true },
    });
    await logActivity({
      userId: user.id,
      action: "course.enrol",
      entity: "course",
      entityId: course.id,
      details: { course: course.title, enrolmentId: enrolment.id, source: "FREE" },
    });
  } catch (error) {
    // Joined twice at once: the second request finds the first one's row.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    return { ok: true, courseSlug: course.slug, alreadyEnrolled: true };
  }
  return { ok: true, courseSlug: course.slug, alreadyEnrolled: false };
}
