"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { lessonTypes } from "@/lib/course";
import { curriculumOrderSchema, lessonFieldsSchema, moduleFieldsSchema, resourceTitleSchema, type CurriculumOrder } from "@/lib/course-form";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { refreshCourses } from "@/lib/revalidate-courses";
import { nextFreeSlug } from "@/lib/slug";
import { logActivity } from "@/services/activity";
import { authorizeCourseAction } from "@/services/course-access";
import { recalculateCourseProgress } from "@/services/learning";
import { readLessonFileToken, removeLessonFile } from "@/services/lesson-file";

// Curriculum edits: modules, lessons, lesson files and resources. Every action
// re-checks the course (course.edit and ownership) and that the ids it is given
// belong to that course; the browser is never trusted with a storage key.

const NOT_FOUND_MODULE = "This module no longer exists.";
const NOT_FOUND_LESSON = "This lesson no longer exists.";
const EXPIRED = "This upload has expired. Upload the file again.";

const idSchema = z.coerce.number().int().positive();

function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formValues(formData),
  };
}

function fail(formData: FormData, error: string, field?: string): FormState {
  return { ok: false, error, fieldErrors: field ? { [field]: [error] } : undefined, values: formValues(formData) };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function courseTitle(courseId: number) {
  return (await db.course.findUnique({ where: { id: courseId }, select: { title: true } }))?.title ?? "";
}

async function freeLessonSlug(courseId: number, base: string, exceptLessonId = 0) {
  return nextFreeSlug(base, async (candidate) =>
    Boolean(await db.lesson.findFirst({ where: { courseId, slug: candidate, id: { not: exceptLessonId } }, select: { id: true } })),
  );
}

// Keeps module and lesson positions a gap-free 0..n-1 after a delete.
async function repackModules(tx: Prisma.TransactionClient, courseId: number) {
  const modules = await tx.courseModule.findMany({ where: { courseId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
  for (const [index, m] of modules.entries()) {
    if (m.position !== index) await tx.courseModule.update({ where: { id: m.id }, data: { position: index } });
  }
}
async function repackLessons(tx: Prisma.TransactionClient, moduleId: number) {
  const lessons = await tx.lesson.findMany({ where: { moduleId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
  for (const [index, l] of lessons.entries()) {
    if (l.position !== index) await tx.lesson.update({ where: { id: l.id }, data: { position: index } });
  }
}

// ---------------------------------------------------------------- modules

export async function createModule(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  if (!courseId.success) return fail(formData, "This course no longer exists.");
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = moduleFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const last = await db.courseModule.aggregate({ where: { courseId: courseId.data }, _max: { position: true } });
  const created = await db.courseModule.create({
    data: { courseId: courseId.data, ...parsed.data, position: (last._max.position ?? -1) + 1 },
    select: { id: true },
  });
  await logActivity({
    userId: authz.user.id,
    action: "course-module.create",
    entity: "course-module",
    entityId: created.id,
    details: { title: parsed.data.title, course: await courseTitle(courseId.data) },
  });
  refreshCourses();
  return { ok: true, message: "Module added." };
}

export async function updateModule(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const moduleId = idSchema.safeParse(formData.get("moduleId"));
  if (!courseId.success || !moduleId.success) return fail(formData, NOT_FOUND_MODULE);
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = moduleFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const courseModule = await db.courseModule.findFirst({ where: { id: moduleId.data, courseId: courseId.data }, select: { title: true } });
  if (!courseModule) return fail(formData, NOT_FOUND_MODULE);
  await db.courseModule.update({ where: { id: moduleId.data }, data: parsed.data });
  await logActivity({
    userId: authz.user.id,
    action: "course-module.update",
    entity: "course-module",
    entityId: moduleId.data,
    details: { from: courseModule.title, to: parsed.data.title, course: await courseTitle(courseId.data) },
  });
  refreshCourses();
  return { ok: true, message: "Module saved." };
}

// Deletes the module with its lessons, their progress and their files.
export async function deleteModule(formData: FormData): Promise<ActionResult> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const moduleId = idSchema.safeParse(formData.get("moduleId"));
  if (!courseId.success || !moduleId.success) return { ok: false, error: NOT_FOUND_MODULE };
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return authz.result;

  const courseModule = await db.courseModule.findFirst({
    where: { id: moduleId.data, courseId: courseId.data },
    select: { title: true, lessons: { select: { published: true, fileKey: true, resources: { select: { fileKey: true } } } } },
  });
  if (!courseModule) return { ok: false, error: NOT_FOUND_MODULE };
  const keys = courseModule.lessons.flatMap((l) => [l.fileKey, ...l.resources.map((r) => r.fileKey)]).filter((k): k is string => Boolean(k));

  await db.$transaction(async (tx) => {
    await tx.courseModule.delete({ where: { id: moduleId.data } });
    await repackModules(tx, courseId.data);
  });
  await Promise.all(keys.map((key) => removeLessonFile(key)));
  await logActivity({
    userId: authz.user.id,
    action: "course-module.delete",
    entity: "course-module",
    entityId: moduleId.data,
    details: { title: courseModule.title, lessons: courseModule.lessons.length, course: await courseTitle(courseId.data) },
  });
  if (courseModule.lessons.some((l) => l.published)) await recalculateCourseProgress(courseId.data);
  refreshCourses();
  return { ok: true, message: "Module deleted." };
}

// ---------------------------------------------------------------- lessons

const createLessonSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Use at most 200 characters."),
  type: z.enum(lessonTypes, { error: "Choose a lesson type." }),
});

// New lessons start hidden: publish them from the lesson editor once they have content.
export async function createLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const moduleId = idSchema.safeParse(formData.get("moduleId"));
  if (!courseId.success || !moduleId.success) return fail(formData, NOT_FOUND_MODULE);
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = createLessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const courseModule = await db.courseModule.findFirst({ where: { id: moduleId.data, courseId: courseId.data }, select: { id: true } });
  if (!courseModule) return fail(formData, NOT_FOUND_MODULE);

  let lessonId: number;
  try {
    lessonId = await db.$transaction(async (tx) => {
      const slug = await freeLessonSlug(courseId.data, parsed.data.title);
      const last = await tx.lesson.aggregate({ where: { moduleId: moduleId.data }, _max: { position: true } });
      const lesson = await tx.lesson.create({
        data: {
          moduleId: moduleId.data,
          courseId: courseId.data,
          title: parsed.data.title,
          slug,
          type: parsed.data.type,
          position: (last._max.position ?? -1) + 1,
          published: false,
        },
        select: { id: true },
      });
      // Later stages rely on every quiz lesson having its Quiz row.
      if (parsed.data.type === "QUIZ") await tx.quiz.create({ data: { lessonId: lesson.id } });
      return lesson.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(formData, "A lesson with that address was just created. Try again.");
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "lesson.create",
    entity: "lesson",
    entityId: lessonId,
    details: { title: parsed.data.title, type: parsed.data.type, course: await courseTitle(courseId.data) },
  });
  refreshCourses();
  return { ok: true, message: "Lesson added." };
}

export async function updateLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const lessonId = idSchema.safeParse(formData.get("lessonId"));
  if (!courseId.success || !lessonId.success) return fail(formData, NOT_FOUND_LESSON);
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = lessonFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId.data, courseId: courseId.data },
    select: { title: true, type: true, fileKey: true, published: true },
  });
  if (!lesson) return fail(formData, NOT_FOUND_LESSON);
  const { data } = parsed;
  if (await db.lesson.findFirst({ where: { courseId: courseId.data, slug: data.slug, id: { not: lessonId.data } }, select: { id: true } })) {
    return fail(formData, "Another lesson in this course already uses this slug.", "slug");
  }
  if (data.published && (lesson.type === "VIDEO" || lesson.type === "DOCUMENT") && !lesson.fileKey) {
    return fail(formData, "Upload the file before publishing this lesson.", "published");
  }
  if (data.published && lesson.type === "QUIZ" && (await db.question.count({ where: { quiz: { lessonId: lessonId.data } } })) === 0) {
    return fail(formData, "Add at least one question before publishing this quiz lesson.", "published");
  }

  try {
    await db.lesson.update({
      where: { id: lessonId.data },
      data: {
        title: data.title,
        slug: data.slug,
        isFreePreview: data.isFreePreview,
        published: data.published,
        durationSeconds: data.durationSeconds,
        // Quiz lessons have no body; the others store rich text (empty is fine).
        ...(lesson.type !== "QUIZ" && data.content ? { content: data.content as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail(formData, "Another lesson in this course already uses this slug.", "slug");
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "lesson.update",
    entity: "lesson",
    entityId: lessonId.data,
    details: { title: data.title, course: await courseTitle(courseId.data) },
  });
  // Publishing or hiding a lesson changes what "all lessons" means.
  if (data.published !== lesson.published) await recalculateCourseProgress(courseId.data);
  refreshCourses();
  return { ok: true, message: "Lesson saved." };
}

export async function deleteLesson(formData: FormData): Promise<ActionResult> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const lessonId = idSchema.safeParse(formData.get("lessonId"));
  if (!courseId.success || !lessonId.success) return { ok: false, error: NOT_FOUND_LESSON };
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return authz.result;

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId.data, courseId: courseId.data },
    select: { title: true, moduleId: true, published: true, fileKey: true, resources: { select: { fileKey: true } } },
  });
  if (!lesson) return { ok: false, error: NOT_FOUND_LESSON };
  const keys = [lesson.fileKey, ...lesson.resources.map((r) => r.fileKey)].filter((k): k is string => Boolean(k));

  await db.$transaction(async (tx) => {
    // Resources, quiz and progress go with the lesson (cascade).
    await tx.lesson.delete({ where: { id: lessonId.data } });
    await repackLessons(tx, lesson.moduleId);
  });
  await Promise.all(keys.map((key) => removeLessonFile(key)));
  await logActivity({
    userId: authz.user.id,
    action: "lesson.delete",
    entity: "lesson",
    entityId: lessonId.data,
    details: { title: lesson.title, course: await courseTitle(courseId.data) },
  });
  if (lesson.published) await recalculateCourseProgress(courseId.data);
  refreshCourses();
  // From the lesson editor: go back to the curriculum (only panel paths are followed).
  const to = String(formData.get("redirectTo") ?? "");
  if (/^\/(admin|instructor)\/courses\/\d+\/curriculum$/.test(to)) redirect(to);
  return { ok: true, message: "Lesson deleted." };
}

const attachSchema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  fileToken: z.string().min(1).max(2000),
  // Read from the video in the browser; only a hint, never trusted beyond a sane range.
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
});

// Called by the uploader once the lesson's file is in the private bucket.
export async function attachLessonFile(input: z.input<typeof attachSchema>): Promise<ActionResult> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { courseId, lessonId, fileToken, durationSeconds } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;

  const lesson = await db.lesson.findFirst({ where: { id: lessonId, courseId }, select: { title: true, type: true, fileKey: true } });
  if (!lesson) return { ok: false, error: NOT_FOUND_LESSON };
  if (lesson.type !== "VIDEO" && lesson.type !== "DOCUMENT") return { ok: false, error: "This lesson type has no file." };
  const file = readLessonFileToken(fileToken, courseId);
  if (!file) return { ok: false, error: EXPIRED };
  if (file.kind !== lesson.type) {
    return { ok: false, error: lesson.type === "VIDEO" ? "Upload a video file." : "Upload a document, not a video." };
  }
  if (lesson.fileKey === file.key) return { ok: true, message: "File saved." };

  await db.lesson.update({
    where: { id: lessonId },
    data: {
      fileKey: file.key,
      fileName: file.filename,
      fileMimeType: file.mimeType,
      fileSize: BigInt(file.size),
      ...(durationSeconds && lesson.type === "VIDEO" ? { durationSeconds } : {}),
    },
  });
  await removeLessonFile(lesson.fileKey);
  await logActivity({
    userId: authz.user.id,
    action: "lesson.update",
    entity: "lesson",
    entityId: lessonId,
    details: { title: lesson.title, fields: ["file"], course: await courseTitle(courseId) },
  });
  refreshCourses();
  return { ok: true, message: "File saved." };
}

// Takes the file off the lesson (and deletes it); an unfinished lesson is hidden again.
export async function detachLessonFile(input: { courseId: number; lessonId: number }): Promise<ActionResult> {
  const parsed = z.object({ courseId: z.number().int().positive(), lessonId: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { courseId, lessonId } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;

  const lesson = await db.lesson.findFirst({ where: { id: lessonId, courseId }, select: { title: true, fileKey: true, published: true } });
  if (!lesson) return { ok: false, error: NOT_FOUND_LESSON };
  if (!lesson.fileKey) return { ok: true, message: "There is no file." };
  await db.lesson.update({
    where: { id: lessonId },
    data: { fileKey: null, fileName: null, fileMimeType: null, fileSize: null, published: false },
  });
  await removeLessonFile(lesson.fileKey);
  await logActivity({
    userId: authz.user.id,
    action: "lesson.update",
    entity: "lesson",
    entityId: lessonId,
    details: { title: lesson.title, fields: ["file"], course: await courseTitle(courseId) },
  });
  if (lesson.published) await recalculateCourseProgress(courseId);
  refreshCourses();
  return { ok: true, message: "File removed. The lesson is hidden until a new file is added." };
}

// ---------------------------------------------------------------- ordering

// Saves the whole order: modules in order, each with its lessons in order.
// Lessons may change module. The list must be exactly the course's modules and
// lessons, so an out-of-date browser cannot drop or invent anything.
export async function reorderCurriculum(input: CurriculumOrder): Promise<ActionResult> {
  const parsed = curriculumOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { courseId, modules } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;

  const current = await db.courseModule.findMany({
    where: { courseId },
    select: { id: true, position: true, lessons: { select: { id: true, moduleId: true, position: true } } },
  });
  const stale = "The curriculum was changed elsewhere. Reload the page to see the latest version.";
  const moduleIds = new Set(current.map((m) => m.id));
  const lessonRows = new Map(current.flatMap((m) => m.lessons).map((l) => [l.id, l]));
  const sentModules = modules.map((m) => m.id);
  const sentLessons = modules.flatMap((m) => m.lessonIds);
  if (
    new Set(sentModules).size !== sentModules.length ||
    new Set(sentLessons).size !== sentLessons.length ||
    sentModules.length !== moduleIds.size ||
    sentLessons.length !== lessonRows.size ||
    sentModules.some((id) => !moduleIds.has(id)) ||
    sentLessons.some((id) => !lessonRows.has(id))
  ) {
    return { ok: false, error: stale };
  }

  const modulePosition = new Map(current.map((m) => [m.id, m.position]));
  await db.$transaction(async (tx) => {
    for (const [index, m] of modules.entries()) {
      if (modulePosition.get(m.id) !== index) await tx.courseModule.update({ where: { id: m.id }, data: { position: index } });
      for (const [position, lessonId] of m.lessonIds.entries()) {
        const row = lessonRows.get(lessonId)!;
        if (row.moduleId !== m.id || row.position !== position) {
          await tx.lesson.update({ where: { id: lessonId }, data: { moduleId: m.id, position } });
        }
      }
    }
  });
  await logActivity({
    userId: authz.user.id,
    action: "course.reorder",
    entity: "course",
    entityId: courseId,
    details: { title: await courseTitle(courseId), modules: modules.length, lessons: sentLessons.length },
  });
  // Only the public pages: re-rendering the builder under the editor's hands would undo
  // a drag that is still being saved. The builder already shows the new order.
  revalidatePath("/courses", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- resources

const resourceSchema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  title: resourceTitleSchema,
  fileToken: z.string().min(1).max(2000),
});

export async function addLessonResource(input: z.input<typeof resourceSchema>): Promise<ActionResult> {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: z.flattenError(parsed.error).fieldErrors.title?.[0] ?? "Invalid request." };
  }
  const { courseId, lessonId, title, fileToken } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;

  const lesson = await db.lesson.findFirst({ where: { id: lessonId, courseId }, select: { title: true } });
  if (!lesson) return { ok: false, error: NOT_FOUND_LESSON };
  const file = readLessonFileToken(fileToken, courseId);
  if (!file || file.kind !== "DOCUMENT") return { ok: false, error: EXPIRED };

  const last = await db.lessonResource.aggregate({ where: { lessonId }, _max: { position: true } });
  const resource = await db.lessonResource.create({
    data: {
      lessonId,
      title,
      fileKey: file.key,
      fileName: file.filename,
      fileMimeType: file.mimeType,
      fileSize: BigInt(file.size),
      position: (last._max.position ?? -1) + 1,
    },
    select: { id: true },
  });
  await logActivity({
    userId: authz.user.id,
    action: "lesson-resource.create",
    entity: "lesson-resource",
    entityId: resource.id,
    details: { title, lesson: lesson.title, course: await courseTitle(courseId) },
  });
  refreshCourses();
  return { ok: true, message: "Resource added." };
}

export async function renameLessonResource(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const resourceId = idSchema.safeParse(formData.get("resourceId"));
  if (!courseId.success || !resourceId.success) return fail(formData, "This resource no longer exists.");
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const title = resourceTitleSchema.safeParse(formData.get("title"));
  if (!title.success) return fail(formData, title.error.issues[0].message, "title");

  const resource = await db.lessonResource.findFirst({
    where: { id: resourceId.data, lesson: { courseId: courseId.data } },
    select: { title: true },
  });
  if (!resource) return fail(formData, "This resource no longer exists.");
  await db.lessonResource.update({ where: { id: resourceId.data }, data: { title: title.data } });
  await logActivity({
    userId: authz.user.id,
    action: "lesson-resource.update",
    entity: "lesson-resource",
    entityId: resourceId.data,
    details: { from: resource.title, to: title.data, course: await courseTitle(courseId.data) },
  });
  refreshCourses();
  return { ok: true, message: "Resource renamed." };
}

export async function deleteLessonResource(formData: FormData): Promise<ActionResult> {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  const resourceId = idSchema.safeParse(formData.get("resourceId"));
  if (!courseId.success || !resourceId.success) return { ok: false, error: "This resource no longer exists." };
  const authz = await authorizeCourseAction(courseId.data, "course.edit");
  if (!authz.ok) return authz.result;

  const resource = await db.lessonResource.findFirst({
    where: { id: resourceId.data, lesson: { courseId: courseId.data } },
    select: { title: true, fileKey: true, lessonId: true },
  });
  if (!resource) return { ok: false, error: "This resource no longer exists." };
  await db.$transaction(async (tx) => {
    await tx.lessonResource.delete({ where: { id: resourceId.data } });
    const rest = await tx.lessonResource.findMany({ where: { lessonId: resource.lessonId }, orderBy: { position: "asc" }, select: { id: true, position: true } });
    for (const [index, r] of rest.entries()) {
      if (r.position !== index) await tx.lessonResource.update({ where: { id: r.id }, data: { position: index } });
    }
  });
  await removeLessonFile(resource.fileKey);
  await logActivity({
    userId: authz.user.id,
    action: "lesson-resource.delete",
    entity: "lesson-resource",
    entityId: resourceId.data,
    details: { title: resource.title, course: await courseTitle(courseId.data) },
  });
  refreshCourses();
  return { ok: true, message: "Resource deleted." };
}

const resourceOrderSchema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  resourceIds: z.array(z.number().int().positive()).max(100),
});

export async function reorderLessonResources(input: z.input<typeof resourceOrderSchema>): Promise<ActionResult> {
  const parsed = resourceOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { courseId, lessonId, resourceIds } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;

  const existing = await db.lessonResource.findMany({ where: { lessonId, lesson: { courseId } }, select: { id: true, position: true } });
  const ids = new Set(existing.map((r) => r.id));
  if (resourceIds.length !== ids.size || new Set(resourceIds).size !== ids.size || resourceIds.some((id) => !ids.has(id))) {
    return { ok: false, error: "The resources were changed elsewhere. Reload the page to see the latest version." };
  }
  const position = new Map(existing.map((r) => [r.id, r.position]));
  await db.$transaction(async (tx) => {
    for (const [index, id] of resourceIds.entries()) {
      if (position.get(id) !== index) await tx.lessonResource.update({ where: { id }, data: { position: index } });
    }
  });
  await logActivity({
    userId: authz.user.id,
    action: "lesson-resource.reorder",
    entity: "lesson",
    entityId: lessonId,
    details: { course: await courseTitle(courseId) },
  });
  refreshCourses();
  return { ok: true };
}
