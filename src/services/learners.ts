import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hasLearnerAccess } from "@/lib/learning";
import { logActivity } from "@/services/activity";
import { recalculateEnrolmentProgress } from "@/services/learning";

// Learners from the admin's side: enrolments, progress, assigning and
// cancelling. Call after the permission checks (enrolment.view / .manage).
// List functions take an optional `courseScope` (a Prisma course filter, for
// example manageableCoursesWhere(user)) so the same screens can show an
// instructor only their own courses.

export type EnrolmentStatusValue = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type EnrolmentRow = {
  id: number;
  user: { id: number; name: string; email: string };
  course: { id: number; title: string; slug: string };
  status: EnrolmentStatusValue;
  source: "FREE" | "ADMIN" | "ORDER";
  progressPercent: number;
  enrolledAt: Date;
  completedAt: Date | null;
  lastActivityAt: Date;
  lessonsDone: number;
  lessonsTotal: number;
  quizAttempts: number;
  bestQuizPercent: number | null;
  certificate: { id: number; code: string; revoked: boolean } | null;
};

const rowSelect = {
  id: true,
  status: true,
  source: true,
  progressPercent: true,
  enrolledAt: true,
  completedAt: true,
  updatedAt: true,
  userId: true,
  courseId: true,
  user: { select: { id: true, name: true, email: true } },
  course: { select: { id: true, title: true, slug: true } },
  certificate: { select: { id: true, code: true, revokedAt: true } },
} satisfies Prisma.EnrolmentSelect;

type BaseRow = Prisma.EnrolmentGetPayload<{ select: typeof rowSelect }>;

// Lessons done, last activity and quiz results for a page of enrolments.
async function withProgress(rows: BaseRow[]): Promise<EnrolmentRow[]> {
  if (rows.length === 0) return [];
  const enrolmentIds = rows.map((r) => r.id);
  const courseIds = [...new Set(rows.map((r) => r.courseId))];
  const [totals, done, activity, attempts] = await Promise.all([
    db.lesson.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, published: true }, _count: { _all: true } }),
    db.lessonProgress.groupBy({
      by: ["enrolmentId"],
      where: { enrolmentId: { in: enrolmentIds }, completedAt: { not: null }, lesson: { published: true } },
      _count: { _all: true },
    }),
    db.lessonProgress.groupBy({ by: ["enrolmentId"], where: { enrolmentId: { in: enrolmentIds } }, _max: { updatedAt: true } }),
    db.quizAttempt.groupBy({
      by: ["enrolmentId"],
      where: { enrolmentId: { in: enrolmentIds }, submittedAt: { not: null } },
      _count: { _all: true },
      _max: { percent: true },
    }),
  ]);
  const total = new Map(totals.map((t) => [t.courseId, t._count._all]));
  const doneBy = new Map(done.map((d) => [d.enrolmentId, d._count._all]));
  const activityBy = new Map(activity.map((a) => [a.enrolmentId, a._max.updatedAt]));
  const attemptBy = new Map(attempts.map((a) => [a.enrolmentId, a]));

  return rows.map((row) => {
    const lastProgress = activityBy.get(row.id);
    const attempt = attemptBy.get(row.id);
    return {
      id: row.id,
      user: row.user,
      course: row.course,
      status: row.status,
      source: row.source,
      progressPercent: row.progressPercent,
      enrolledAt: row.enrolledAt,
      completedAt: row.completedAt,
      lastActivityAt: lastProgress && lastProgress > row.updatedAt ? lastProgress : row.updatedAt,
      lessonsDone: doneBy.get(row.id) ?? 0,
      lessonsTotal: total.get(row.courseId) ?? 0,
      quizAttempts: attempt?._count._all ?? 0,
      bestQuizPercent: attempt?._max.percent ?? null,
      certificate: row.certificate ? { id: row.certificate.id, code: row.certificate.code, revoked: row.certificate.revokedAt !== null } : null,
    };
  });
}

export const ENROLMENT_PAGE_SIZE = 15;
export const ENROLMENT_SORT_KEYS = ["learner", "course", "status", "progress", "enrolled", "activity"] as const;
export type EnrolmentSortKey = (typeof ENROLMENT_SORT_KEYS)[number];

export type EnrolmentFilters = {
  // Learner name or email, or course title.
  search?: string;
  courseId?: number;
  userId?: number;
  status?: EnrolmentStatusValue;
  page?: number;
  pageSize?: number;
  sort: EnrolmentSortKey;
  order: "asc" | "desc";
};

export async function listEnrolments(filters: EnrolmentFilters, courseScope?: Prisma.CourseWhereInput) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = filters.pageSize ?? ENROLMENT_PAGE_SIZE;
  const search = filters.search?.trim();
  const where: Prisma.EnrolmentWhereInput = {
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(courseScope && Object.keys(courseScope).length > 0 ? { course: courseScope } : {}),
    ...(search
      ? { OR: [{ user: { name: { contains: search } } }, { user: { email: { contains: search } } }, { course: { title: { contains: search } } }] }
      : {}),
  };
  const dir = filters.order;
  const orderBy: Prisma.EnrolmentOrderByWithRelationInput[] = [
    filters.sort === "learner"
      ? { user: { name: dir } }
      : filters.sort === "course"
        ? { course: { title: dir } }
        : filters.sort === "status"
          ? { status: dir }
          : filters.sort === "progress"
            ? { progressPercent: dir }
            : filters.sort === "enrolled"
              ? { enrolledAt: dir }
              : { updatedAt: dir },
    { id: "desc" },
  ];
  const [rows, total] = await Promise.all([
    db.enrolment.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, select: rowSelect }),
    db.enrolment.count({ where }),
  ]);
  return { rows: await withProgress(rows), total, page, pageSize };
}

export const LEARNER_PAGE_SIZE = 15;
export const LEARNER_SORT_KEYS = ["name", "email", "joined"] as const;
export type LearnerSortKey = (typeof LEARNER_SORT_KEYS)[number];

export type LearnerRow = {
  id: number;
  name: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  joinedAt: Date;
  enrolments: number;
  completed: number;
  certificates: number;
  averageProgress: number;
  lastActivityAt: Date | null;
};

// People who have taken part in a course (any enrolment), with totals.
export async function listLearners(
  filters: { search?: string; page?: number; sort: LearnerSortKey; order: "asc" | "desc" },
  courseScope?: Prisma.CourseWhereInput,
) {
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();
  const scope = courseScope && Object.keys(courseScope).length > 0 ? courseScope : undefined;
  const where: Prisma.UserWhereInput = {
    enrolments: { some: scope ? { course: scope } : {} },
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };
  const dir = filters.order;
  const orderBy: Prisma.UserOrderByWithRelationInput[] = [
    filters.sort === "joined" ? { createdAt: dir } : filters.sort === "email" ? { email: dir } : { name: dir },
    { id: "asc" },
  ];
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * LEARNER_PAGE_SIZE,
      take: LEARNER_PAGE_SIZE,
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    }),
    db.user.count({ where }),
  ]);
  const ids = users.map((u) => u.id);
  const enrolmentWhere: Prisma.EnrolmentWhereInput = { userId: { in: ids }, status: { not: "CANCELLED" }, ...(scope ? { course: scope } : {}) };
  const [byStatus, averages, certificates] = ids.length
    ? await Promise.all([
        db.enrolment.groupBy({ by: ["userId", "status"], where: enrolmentWhere, _count: { _all: true }, _max: { updatedAt: true } }),
        db.enrolment.groupBy({ by: ["userId"], where: enrolmentWhere, _avg: { progressPercent: true } }),
        db.certificate.groupBy({ by: ["userId"], where: { userId: { in: ids }, revokedAt: null, ...(scope ? { course: scope } : {}) }, _count: { _all: true } }),
      ])
    : [[], [], []];

  const rows: LearnerRow[] = users.map((user) => {
    const mine = byStatus.filter((g) => g.userId === user.id);
    const last = mine.map((g) => g._max.updatedAt).filter((d): d is Date => d !== null);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      joinedAt: user.createdAt,
      enrolments: mine.reduce((sum, g) => sum + g._count._all, 0),
      completed: mine.filter((g) => g.status === "COMPLETED").reduce((sum, g) => sum + g._count._all, 0),
      certificates: certificates.find((c) => c.userId === user.id)?._count._all ?? 0,
      averageProgress: Math.round(averages.find((a) => a.userId === user.id)?._avg.progressPercent ?? 0),
      lastActivityAt: last.length ? new Date(Math.max(...last.map((d) => d.getTime()))) : null,
    };
  });
  return { rows, total, page, pageSize: LEARNER_PAGE_SIZE };
}

export type QuizResultRow = {
  lessonId: number;
  lessonTitle: string;
  courseId: number;
  courseTitle: string;
  attempts: number;
  bestPercent: number | null;
  passed: boolean;
  lastAttemptAt: Date | null;
};

// One learner's quiz results, one row per quiz they have attempted.
export async function getLearnerQuizResults(userId: number, courseScope?: Prisma.CourseWhereInput): Promise<QuizResultRow[]> {
  const attempts = await db.quizAttempt.findMany({
    where: {
      userId,
      submittedAt: { not: null },
      ...(courseScope && Object.keys(courseScope).length > 0 ? { quiz: { lesson: { course: courseScope } } } : {}),
    },
    orderBy: { id: "asc" },
    select: {
      quizId: true,
      percent: true,
      passed: true,
      submittedAt: true,
      quiz: { select: { lesson: { select: { id: true, title: true, course: { select: { id: true, title: true } } } } } },
    },
  });
  const byQuiz = new Map<number, QuizResultRow>();
  for (const attempt of attempts) {
    const lesson = attempt.quiz.lesson;
    const row = byQuiz.get(attempt.quizId) ?? {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      courseId: lesson.course.id,
      courseTitle: lesson.course.title,
      attempts: 0,
      bestPercent: null,
      passed: false,
      lastAttemptAt: null,
    };
    row.attempts++;
    row.bestPercent = row.bestPercent === null ? attempt.percent : Math.max(row.bestPercent, attempt.percent ?? 0);
    row.passed = row.passed || Boolean(attempt.passed);
    row.lastAttemptAt = attempt.submittedAt;
    byQuiz.set(attempt.quizId, row);
  }
  return [...byQuiz.values()];
}

// ---------------------------------------------------------------- assign, cancel

export type EnrolmentChange =
  | { ok: true; enrolmentId: number; learner: string; course: string; reactivated?: boolean }
  | { ok: false; error: string };

// Cancelled enrolments come back to life (completed ones as completed) and the
// progress is counted again; a certificate they earned is untouched.
async function reactivate(enrolmentId: number, actorId: number, kind: "assign" | "reactivate"): Promise<EnrolmentChange> {
  const row = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { id: true, status: true, completedAt: true, user: { select: { name: true } }, course: { select: { title: true } } },
  });
  if (!row) return { ok: false, error: "This enrolment no longer exists." };
  const learner = row.user.name;
  const course = row.course.title;
  if (row.status !== "CANCELLED") return { ok: false, error: `${learner} is already enrolled in this course.` };

  await db.enrolment.update({
    where: { id: enrolmentId },
    data: { status: row.completedAt ? "COMPLETED" : "ACTIVE", assignedById: actorId },
  });
  await recalculateEnrolmentProgress(enrolmentId);
  await logActivity({
    userId: actorId,
    action: kind === "assign" ? "enrolment.assign" : "enrolment.reactivate",
    entity: "enrolment",
    entityId: enrolmentId,
    details: { learner, course, reactivated: true },
  });
  return { ok: true, enrolmentId, learner, course, reactivated: true };
}

// Gives a learner a course (the way paid courses are handed out until
// payments exist). A cancelled enrolment is reactivated rather than refused.
export async function assignCourse(actorId: number, userId: number, courseId: number): Promise<EnrolmentChange> {
  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, status: true } }),
    db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, status: true } }),
  ]);
  if (!user) return { ok: false, error: "This user no longer exists." };
  if (user.status !== "ACTIVE") return { ok: false, error: `${user.name}'s account is ${user.status.toLowerCase()}. Reactivate it first.` };
  if (!course) return { ok: false, error: "This course no longer exists." };
  if (course.status !== "PUBLISHED") return { ok: false, error: "Only published courses can be assigned." };

  const existing = await db.enrolment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true, status: true } });
  if (existing) {
    if (hasLearnerAccess(existing.status)) return { ok: false, error: `${user.name} is already enrolled in this course.` };
    return reactivate(existing.id, actorId, "assign");
  }
  try {
    const created = await db.enrolment.create({
      data: { userId, courseId, source: "ADMIN", assignedById: actorId },
      select: { id: true },
    });
    await logActivity({
      userId: actorId,
      action: "enrolment.assign",
      entity: "enrolment",
      entityId: created.id,
      details: { learner: user.name, course: course.title, reactivated: false },
    });
    return { ok: true, enrolmentId: created.id, learner: user.name, course: course.title };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: `${user.name} is already enrolled in this course.` };
    }
    throw error;
  }
}

export async function reactivateEnrolment(actorId: number, enrolmentId: number) {
  return reactivate(enrolmentId, actorId, "reactivate");
}

// Cancels access to the course; the enrolment, progress and any certificate stay.
export async function cancelEnrolment(actorId: number, enrolmentId: number): Promise<EnrolmentChange> {
  const row = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { status: true, user: { select: { name: true } }, course: { select: { title: true } } },
  });
  if (!row) return { ok: false, error: "This enrolment no longer exists." };
  const learner = row.user.name;
  const course = row.course.title;
  if (row.status === "CANCELLED") return { ok: false, error: "This enrolment is already cancelled." };
  await db.enrolment.update({ where: { id: enrolmentId }, data: { status: "CANCELLED" } });
  await logActivity({
    userId: actorId,
    action: "enrolment.cancel",
    entity: "enrolment",
    entityId: enrolmentId,
    details: { learner, course, from: row.status },
  });
  return { ok: true, enrolmentId, learner, course };
}

// ---------------------------------------------------------------- pickers

// Users matching a search, for choosing who to assign a course to.
export async function searchUsers(search: string, limit = 10) {
  const q = search.trim();
  if (!q) return [];
  return db.user.findMany({
    where: { status: "ACTIVE", OR: [{ name: { contains: q } }, { email: { contains: q } }] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, name: true, email: true },
  });
}

export async function getUserBrief(id: number) {
  return db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, status: true } });
}

// Published courses a learner could be given, without the ones they already have.
export async function listAssignableCourses(userId: number | null, courseScope?: Prisma.CourseWhereInput) {
  return db.course.findMany({
    where: {
      status: "PUBLISHED",
      ...(courseScope ?? {}),
      ...(userId ? { NOT: { enrolments: { some: { userId, status: { in: ["ACTIVE", "COMPLETED"] } } } } } : {}),
    },
    orderBy: { title: "asc" },
    select: { id: true, title: true, price: true },
  });
}

export async function listCourseOptions(courseScope?: Prisma.CourseWhereInput) {
  return db.course.findMany({ where: courseScope, orderBy: { title: "asc" }, select: { id: true, title: true } });
}
