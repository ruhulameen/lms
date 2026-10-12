import "server-only";
import { db } from "@/lib/db";
import { isPublic } from "@/lib/content-status";
import { DOWNLOAD_URL_TTL_SECONDS, VIDEO_URL_TTL_SECONDS, isPrivateStorageConfigured, privateStorage } from "@/lib/storage";
import { canManageCourse } from "@/services/course-access";
import type { CurrentUser } from "@/services/user";

// The only way lesson files leave the private bucket. Every function checks who
// is asking, then returns a short-lived signed link. Call them while rendering
// a page or inside a server action, never from a route the browser polls, and
// never store the link: it expires.

export type LessonTarget = { id: number; courseId: number; isFreePreview: boolean; published: boolean };

// A learner keeps access after finishing; a cancelled enrolment loses it.
const ENROLMENT_ACCESS = ["ACTIVE", "COMPLETED"] as const;

// May `user` (null = signed out) open this lesson and its files?
// - the course's staff (canManageCourse: its instructor or creator, anyone with
//   course.publish, admin) always, even for unpublished lessons and courses;
// - an enrolled learner, for published lessons;
// - anyone, for a free-preview lesson of a publicly visible course.
export async function canAccessLesson(user: CurrentUser | null, lesson: LessonTarget) {
  const course = await db.course.findUnique({
    where: { id: lesson.courseId },
    select: { status: true, publishAt: true, instructorId: true, createdById: true },
  });
  if (!course) return false;

  if (user && canManageCourse(user, course)) return true;
  if (!lesson.published) return false;
  if (lesson.isFreePreview && isPublic(course.status, course.publishAt)) return true;
  if (!user) return false;

  const enrolment = await db.enrolment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } },
    select: { status: true },
  });
  return Boolean(enrolment && (ENROLMENT_ACCESS as readonly string[]).includes(enrolment.status));
}

export type FileLink =
  | { ok: true; url: string; filename: string; mimeType: string; size: number; expiresAt: Date }
  | { ok: false; reason: "not-found" | "forbidden" | "no-file" | "not-configured" };

type FileFields = { key: string; filename: string; mimeType: string; size: bigint | number };

async function link(file: FileFields, mode: "play" | "download"): Promise<FileLink> {
  if (!isPrivateStorageConfigured()) return { ok: false, reason: "not-configured" };
  const expiresIn = mode === "play" ? VIDEO_URL_TTL_SECONDS : DOWNLOAD_URL_TTL_SECONDS;
  const url = await privateStorage.presignGet(file.key, {
    expiresIn,
    filename: file.filename,
    inline: mode === "play",
    contentType: file.mimeType,
  });
  return {
    ok: true,
    url,
    filename: file.filename,
    mimeType: file.mimeType,
    size: Number(file.size),
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

// The file of a video or document lesson. `mode` "play" gives a link that shows
// the file in the browser for an hour (video, and PDFs in a viewer); "download"
// forces a save with the original name and lasts five minutes. Default: "play"
// for video lessons, "download" for documents.
export async function getLessonFileUrl(
  user: CurrentUser | null,
  lessonId: number,
  options: { mode?: "play" | "download" } = {},
): Promise<FileLink> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      courseId: true,
      isFreePreview: true,
      published: true,
      type: true,
      fileKey: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
    },
  });
  if (!lesson) return { ok: false, reason: "not-found" };
  if (!(await canAccessLesson(user, lesson))) return { ok: false, reason: "forbidden" };
  if (!lesson.fileKey || !lesson.fileName || !lesson.fileMimeType || lesson.fileSize === null) {
    return { ok: false, reason: "no-file" };
  }
  return link(
    { key: lesson.fileKey, filename: lesson.fileName, mimeType: lesson.fileMimeType, size: lesson.fileSize },
    options.mode ?? (lesson.type === "VIDEO" ? "play" : "download"),
  );
}

// A downloadable resource attached to a lesson; same access as the lesson.
export async function getLessonResourceUrl(user: CurrentUser | null, resourceId: number): Promise<FileLink> {
  const resource = await db.lessonResource.findUnique({
    where: { id: resourceId },
    select: {
      fileKey: true,
      fileName: true,
      fileMimeType: true,
      fileSize: true,
      lesson: { select: { id: true, courseId: true, isFreePreview: true, published: true } },
    },
  });
  if (!resource) return { ok: false, reason: "not-found" };
  if (!(await canAccessLesson(user, resource.lesson))) return { ok: false, reason: "forbidden" };
  return link(
    { key: resource.fileKey, filename: resource.fileName, mimeType: resource.fileMimeType, size: resource.fileSize },
    "download",
  );
}

// The course's intro video: a promo, so anyone may watch it once the course is
// publicly visible; staff may watch it any time.
export async function getCourseIntroVideoUrl(user: CurrentUser | null, courseId: number): Promise<FileLink> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      status: true,
      publishAt: true,
      instructorId: true,
      createdById: true,
      introVideoKey: true,
      introVideoName: true,
      introVideoMime: true,
      introVideoSize: true,
    },
  });
  if (!course) return { ok: false, reason: "not-found" };
  if (!isPublic(course.status, course.publishAt) && !(user && canManageCourse(user, course))) {
    return { ok: false, reason: "forbidden" };
  }
  if (!course.introVideoKey || !course.introVideoName || !course.introVideoMime || course.introVideoSize === null) {
    return { ok: false, reason: "no-file" };
  }
  return link(
    { key: course.introVideoKey, filename: course.introVideoName, mimeType: course.introVideoMime, size: course.introVideoSize },
    "play",
  );
}
