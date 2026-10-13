import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isPublic } from "@/lib/content-status";
import type { LessonTypeValue } from "@/lib/course";
import {
  adjacentLessons,
  clampPosition,
  completionMode,
  enrolmentOutcome,
  hasLearnerAccess,
  pickResumeLesson,
  resumePosition,
  videoWatchedEnough,
} from "@/lib/learning";
import { logActivity } from "@/services/activity";
import { issueCertificate } from "@/services/certificate";
import { canManageCourse } from "@/services/course-access";
import { canAccessLesson } from "@/services/lesson-access";
import type { CurrentUser } from "@/services/user";

// Learning: the course player's data and the progress a learner makes.
// The rules (when a lesson is done, where to resume) are in src/lib/learning.ts.

const orderedLessons = [{ module: { position: "asc" } }, { position: "asc" }, { id: "asc" }] as const;

export type PlayerLesson = {
  id: number;
  title: string;
  slug: string;
  type: LessonTypeValue;
  durationSeconds: number | null;
  isFreePreview: boolean;
  published: boolean;
  moduleId: number;
  completed: boolean;
  // Whether this viewer may open it (the lock icon in the sidebar).
  accessible: boolean;
};

export type PlayerModule = { id: number; title: string; lessons: PlayerLesson[] };

export type PlayerContext =
  | { status: "not-found" }
  | { status: "denied"; signedIn: boolean }
  | {
      status: "ok";
      course: { id: number; title: string; slug: string };
      // The viewer's enrolment when it gives learner access; progress is only saved then.
      enrolment: { id: number; status: "ACTIVE" | "COMPLETED"; progressPercent: number } | null;
      staff: boolean;
      modules: PlayerModule[];
      lessons: PlayerLesson[];
      lesson: {
        id: number;
        title: string;
        slug: string;
        type: LessonTypeValue;
        // Rich text: the body of a text lesson, notes under the others.
        content: unknown;
        hasFile: boolean;
        fileName: string | null;
        fileMimeType: string | null;
        fileSize: number | null;
        durationSeconds: number | null;
        completed: boolean;
        startAt: number;
        mode: ReturnType<typeof completionMode>;
        resources: { id: number; title: string; fileName: string; fileSize: number }[];
      };
      previous: PlayerLesson | null;
      next: PlayerLesson | null;
    };

type CourseLookup = {
  id: number;
  title: string;
  slug: string;
  status: Parameters<typeof isPublic>[0];
  publishAt: Date | null;
  instructorId: number | null;
  createdById: number | null;
};

async function loadCourse(slug: string): Promise<CourseLookup | null> {
  return db.course.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true, status: true, publishAt: true, instructorId: true, createdById: true },
  });
}

// Everything the player page needs for one lesson, with the access decision:
// staff of the course, enrolled learners (published lessons) and free-preview
// lessons of a public course.
export async function getPlayerContext(
  user: CurrentUser | null,
  courseSlug: string,
  lessonSlug: string,
): Promise<PlayerContext> {
  const course = await loadCourse(courseSlug);
  if (!course) return { status: "not-found" };

  const staff = Boolean(user && canManageCourse(user, course));
  const enrolmentRow = user
    ? await db.enrolment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { id: true, status: true, progressPercent: true },
      })
    : null;
  const enrolment = enrolmentRow && hasLearnerAccess(enrolmentRow.status)
    ? { id: enrolmentRow.id, status: enrolmentRow.status as "ACTIVE" | "COMPLETED", progressPercent: enrolmentRow.progressPercent }
    : null;
  const publicCourse = isPublic(course.status, course.publishAt);

  const rows = await db.lesson.findMany({
    where: { courseId: course.id, ...(staff ? {} : { published: true }) },
    orderBy: [...orderedLessons],
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      durationSeconds: true,
      isFreePreview: true,
      published: true,
      moduleId: true,
      module: { select: { id: true, title: true } },
    },
  });
  const done = enrolment
    ? await db.lessonProgress.findMany({
        where: { enrolmentId: enrolment.id, completedAt: { not: null } },
        select: { lessonId: true },
      })
    : [];
  const completedIds = new Set(done.map((d) => d.lessonId));

  // Mirrors canAccessLesson() for the whole list; the open lesson is checked
  // with canAccessLesson() itself below.
  const lessons: PlayerLesson[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    durationSeconds: row.durationSeconds,
    isFreePreview: row.isFreePreview,
    published: row.published,
    moduleId: row.moduleId,
    completed: completedIds.has(row.id),
    accessible: staff || (row.published && (Boolean(enrolment) || (row.isFreePreview && publicCourse))),
  }));

  const current = rows.find((row) => row.slug === lessonSlug);
  if (!current) return { status: "not-found" };
  if (!(await canAccessLesson(user, { id: current.id, courseId: course.id, isFreePreview: current.isFreePreview, published: current.published }))) {
    return { status: "denied", signedIn: user !== null };
  }

  const detail = await db.lesson.findUnique({
    where: { id: current.id },
    select: {
      content: true,
      fileKey: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
      resources: { orderBy: { position: "asc" }, select: { id: true, title: true, fileName: true, fileSize: true } },
    },
  });
  if (!detail) return { status: "not-found" };

  const progress = enrolment
    ? await db.lessonProgress.findUnique({
        where: { enrolmentId_lessonId: { enrolmentId: enrolment.id, lessonId: current.id } },
        select: { lastPositionSeconds: true },
      })
    : null;

  const modules: PlayerModule[] = [];
  for (const lesson of lessons) {
    let group = modules.find((m) => m.id === lesson.moduleId);
    if (!group) {
      const title = rows.find((r) => r.moduleId === lesson.moduleId)!.module.title;
      group = { id: lesson.moduleId, title, lessons: [] };
      modules.push(group);
    }
    group.lessons.push(lesson);
  }

  const hasFile = Boolean(detail.fileKey);
  const { previous, next } = adjacentLessons(lessons, current.id);
  return {
    status: "ok",
    course: { id: course.id, title: course.title, slug: course.slug },
    enrolment,
    staff,
    modules,
    lessons,
    lesson: {
      id: current.id,
      title: current.title,
      slug: current.slug,
      type: current.type,
      content: detail.content,
      hasFile,
      fileName: detail.fileName,
      fileMimeType: detail.fileMimeType,
      fileSize: detail.fileSize === null ? null : Number(detail.fileSize),
      durationSeconds: current.durationSeconds,
      completed: completedIds.has(current.id),
      startAt: resumePosition(progress?.lastPositionSeconds ?? 0, current.durationSeconds),
      mode: completionMode(current.type, hasFile),
      resources: detail.resources.map((r) => ({ ...r, fileSize: Number(r.fileSize) })),
    },
    previous,
    next,
  };
}

// For /learn/<course>: the lesson slug to open, or null to go to the course page.
export async function getResumeLessonSlug(user: CurrentUser | null, courseSlug: string): Promise<string | null> {
  const course = await loadCourse(courseSlug);
  if (!course || !user) return null;
  const staff = canManageCourse(user, course);
  const enrolment = await db.enrolment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true, status: true, lastLessonId: true },
  });
  const learner = Boolean(enrolment && hasLearnerAccess(enrolment.status));
  if (!learner && !staff) return null;

  const lessons = await db.lesson.findMany({
    where: { courseId: course.id, ...(staff && !learner ? {} : { published: true }) },
    orderBy: [...orderedLessons],
    select: { id: true, slug: true },
  });
  const done = learner
    ? await db.lessonProgress.findMany({
        where: { enrolmentId: enrolment!.id, completedAt: { not: null } },
        select: { lessonId: true },
      })
    : [];
  const pick = pickResumeLesson(lessons, new Set(done.map((d) => d.lessonId)), enrolment?.lastLessonId);
  return pick?.slug ?? null;
}

// The next lesson to take for each of several enrolments (dashboard cards).
export async function getResumeLessons(
  enrolments: { id: number; courseId: number; lastLessonId: number | null }[],
) {
  const result = new Map<number, { slug: string; title: string } | null>();
  if (enrolments.length === 0) return result;
  const [lessons, done] = await Promise.all([
    db.lesson.findMany({
      where: { courseId: { in: enrolments.map((e) => e.courseId) }, published: true },
      orderBy: [...orderedLessons],
      select: { id: true, slug: true, title: true, courseId: true },
    }),
    db.lessonProgress.findMany({
      where: { enrolmentId: { in: enrolments.map((e) => e.id) }, completedAt: { not: null }, lesson: { published: true } },
      select: { enrolmentId: true, lessonId: true },
    }),
  ]);
  for (const enrolment of enrolments) {
    const mine = lessons.filter((l) => l.courseId === enrolment.courseId);
    const completed = new Set(done.filter((d) => d.enrolmentId === enrolment.id).map((d) => d.lessonId));
    const pick = pickResumeLesson(mine, completed, enrolment.lastLessonId);
    result.set(enrolment.id, pick ? { slug: pick.slug, title: pick.title } : null);
  }
  return result;
}

// Remember where the learner is, so "continue" brings them back here.
export async function touchLastLesson(enrolmentId: number, lessonId: number) {
  await db.enrolment.updateMany({
    where: { id: enrolmentId, NOT: { lastLessonId: lessonId } },
    data: { lastLessonId: lessonId },
  });
}

// Creates the progress row if missing. Two requests may race to create it.
async function ensureProgress(enrolmentId: number, lessonId: number) {
  try {
    await db.lessonProgress.upsert({
      where: { enrolmentId_lessonId: { enrolmentId, lessonId } },
      create: { enrolmentId, lessonId },
      update: {},
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
}

export type ProgressUpdate = {
  progressPercent: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  // True only for the change that finished the course.
  justCompleted: boolean;
};

// Recounts a course's progress from the lesson records and caches it on the
// enrolment; the single place that moves an enrolment to COMPLETED.
//
// The change that finishes the course also issues the learner's certificate.
export async function recalculateEnrolmentProgress(enrolmentId: number): Promise<ProgressUpdate | null> {
  const enrolment = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { id: true, userId: true, courseId: true, status: true, course: { select: { title: true } } },
  });
  if (!enrolment || enrolment.status === "CANCELLED") return null;

  const [total, completed] = await Promise.all([
    db.lesson.count({ where: { courseId: enrolment.courseId, published: true } }),
    db.lessonProgress.count({ where: { enrolmentId, completedAt: { not: null }, lesson: { published: true } } }),
  ]);
  const outcome = enrolmentOutcome(completed, total, enrolment.status);

  let justCompleted = false;
  if (outcome.justCompleted) {
    // Only one of several concurrent requests flips ACTIVE to COMPLETED.
    const flipped = await db.enrolment.updateMany({
      where: { id: enrolmentId, status: "ACTIVE" },
      data: { status: "COMPLETED", completedAt: new Date(), progressPercent: outcome.percent },
    });
    justCompleted = flipped.count === 1;
  } else {
    await db.enrolment.update({ where: { id: enrolmentId }, data: { progressPercent: outcome.percent } });
  }

  if (justCompleted) {
    await logActivity({
      userId: enrolment.userId,
      action: "course.complete",
      entity: "course",
      entityId: enrolment.courseId,
      details: { course: enrolment.course.title, enrolmentId },
    });
    await issueCertificate(enrolmentId);
  }
  return { progressPercent: outcome.percent, status: outcome.status, justCompleted };
}

// Recounts every enrolment of a course, for when its set of published lessons
// changes (a lesson is deleted, hidden or published). An enrolment whose last
// unfinished lesson went away completes, and gets its certificate; a COMPLETED
// one stays completed when lessons are added.
export async function recalculateCourseProgress(courseId: number) {
  const enrolments = await db.enrolment.findMany({
    where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  let completed = 0;
  for (const { id } of enrolments) {
    const update = await recalculateEnrolmentProgress(id);
    if (update?.justCompleted) completed++;
  }
  return { enrolments: enrolments.length, completed };
}

// Marks a lesson done for an enrolment and updates the course. Used by the
// rules below and when a quiz is passed. It does not check who is
// asking or how the lesson completes; callers do.
export async function completeLessonForEnrolment(enrolmentId: number, lessonId: number) {
  await ensureProgress(enrolmentId, lessonId);
  await db.lessonProgress.updateMany({
    where: { enrolmentId, lessonId, completedAt: null },
    data: { completedAt: new Date() },
  });
  return recalculateEnrolmentProgress(enrolmentId);
}

type LessonForProgress = {
  id: number;
  type: LessonTypeValue;
  durationSeconds: number | null;
  fileKey: string | null;
};

// The lesson and the learner's enrolment, if the learner may learn it: enrolled
// with access and the lesson published. Null otherwise.
export async function learnerLesson(userId: number, lessonId: number) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true, type: true, durationSeconds: true, fileKey: true, published: true },
  });
  if (!lesson || !lesson.published) return null;
  const enrolment = await db.enrolment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.courseId } },
    select: { id: true, status: true },
  });
  if (!enrolment || !hasLearnerAccess(enrolment.status)) return null;
  return { lesson: lesson as LessonForProgress, enrolmentId: enrolment.id };
}

export type MarkCompleteResult =
  | ({ ok: true } & ProgressUpdate)
  | { ok: false; error: string };

// The learner pressed "Mark as complete" (text, document and file-less video lessons).
export async function markLessonCompleteByLearner(userId: number, lessonId: number): Promise<MarkCompleteResult> {
  const found = await learnerLesson(userId, lessonId);
  if (!found) return { ok: false, error: "You are not enrolled in this course." };
  const mode = completionMode(found.lesson.type, Boolean(found.lesson.fileKey));
  if (mode !== "manual") {
    const error =
      mode === "quiz"
        ? "Pass the quiz to complete this lesson."
        : mode === "scorm"
          ? "This lesson completes when you finish the course inside it."
          : "This video completes when you have watched it.";
    return { ok: false, error };
  }
  const update = await completeLessonForEnrolment(found.enrolmentId, lessonId);
  if (!update) return { ok: false, error: "Your enrolment is no longer active." };
  return { ok: true, ...update };
}

export type SavePositionResult =
  | { ok: true; completed: boolean; progressPercent: number; justCompleted: boolean }
  | { ok: false; error: string };

// Saves where the learner is in a video, and completes the lesson once enough
// of it has been watched. `reportedDuration` (from the player) is used only
// when the lesson has no stored duration.
export async function saveVideoPosition(
  userId: number,
  lessonId: number,
  positionSeconds: number,
  reportedDuration: number | null,
): Promise<SavePositionResult> {
  const found = await learnerLesson(userId, lessonId);
  if (!found || found.lesson.type !== "VIDEO") return { ok: false, error: "Progress is not saved for this lesson." };

  const duration = found.lesson.durationSeconds ?? (reportedDuration && reportedDuration > 0 ? reportedDuration : null);
  const position = clampPosition(positionSeconds, duration);
  const progressWhere = { enrolmentId_lessonId: { enrolmentId: found.enrolmentId, lessonId } };

  await ensureProgress(found.enrolmentId, lessonId);
  await db.lessonProgress.update({ where: progressWhere, data: { lastPositionSeconds: position } });

  if (completionMode("VIDEO", Boolean(found.lesson.fileKey)) === "watch" && videoWatchedEnough(position, duration)) {
    const update = await completeLessonForEnrolment(found.enrolmentId, lessonId);
    if (update) return { ok: true, completed: true, progressPercent: update.progressPercent, justCompleted: update.justCompleted };
  }
  const row = await db.lessonProgress.findUnique({ where: progressWhere, select: { completedAt: true } });
  const enrolment = await db.enrolment.findUnique({ where: { id: found.enrolmentId }, select: { progressPercent: true } });
  return { ok: true, completed: Boolean(row?.completedAt), progressPercent: enrolment?.progressPercent ?? 0, justCompleted: false };
}
