"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import {
  allowedTransitions,
  canTransition,
  publishFieldsSchema,
  statusFields,
  type ContentStatusValue,
} from "@/lib/content-status";
import { courseFieldsSchema, courseStatusActivity } from "@/lib/course-form";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { refreshCourses } from "@/lib/revalidate-courses";
import { isEmptyDocument } from "@/lib/rich-text";
import { seoFieldsSchema } from "@/lib/seo";
import { nextFreeSlug, slugify } from "@/lib/slug";
import { logActivity } from "@/services/activity";
import { authorizeCourseAction } from "@/services/course-access";
import { listInstructorOptions } from "@/services/course-admin";
import { readLessonFileToken, removeLessonFile } from "@/services/lesson-file";
import { deleteSeo, getSeo, upsertSeo } from "@/services/seo";
import { authorizeAction, can } from "@/services/user";

const NOT_FOUND = "This course no longer exists.";
const LOCKED = "This course is published, scheduled or archived. Only someone who can publish courses may change it.";
const TAG_NAME_MAX = 50;
const RACE = "That slug or tag was just taken by someone else. Try again.";

type Tx = Prisma.TransactionClient;

function invalid(error: z.ZodError | Record<string, string[]>, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: error instanceof z.ZodError ? z.flattenError(error).fieldErrors : error,
    values: formValues(formData),
  };
}

function fieldError(field: string, message: string, formData: FormData): FormState {
  return { ok: false, error: message, fieldErrors: { [field]: [message] }, values: formValues(formData) };
}

function idFrom(value: FormDataEntryValue | null) {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type Parsed = {
  fields: z.output<typeof courseFieldsSchema>;
  seo: z.output<typeof seoFieldsSchema>;
  status: ContentStatusValue;
  publishAt: Date | null;
  tagIds: number[];
  newTags: string[];
};

function parseForm(formData: FormData): { ok: true; data: Parsed } | { ok: false; state: FormState } {
  const raw = Object.fromEntries(formData);
  const fields = courseFieldsSchema.safeParse(raw);
  const seo = seoFieldsSchema.safeParse(raw);
  const publish = publishFieldsSchema.safeParse(raw);

  const errors: Record<string, string[]> = {};
  if (!fields.success) Object.assign(errors, z.flattenError(fields.error).fieldErrors);
  if (!seo.success) Object.assign(errors, z.flattenError(seo.error).fieldErrors);
  if (!publish.success) Object.assign(errors, z.flattenError(publish.error).fieldErrors);

  const tagIds = [...new Set(formData.getAll("tagIds").map(idFrom).filter((n): n is number => n !== null))];
  const newTags = [...new Set(formData.getAll("newTags").map((v) => String(v).trim()).filter(Boolean))];
  if (newTags.some((name) => name.length > TAG_NAME_MAX || !slugify(name))) {
    errors.tags = [`Tag names need letters or numbers and at most ${TAG_NAME_MAX} characters.`];
  }

  if (!fields.success || !seo.success || !publish.success || Object.keys(errors).length > 0) {
    return { ok: false, state: invalid(errors, formData) };
  }
  return {
    ok: true,
    data: { fields: fields.data, seo: seo.data, status: publish.data.status, publishAt: publish.data.publishAt, tagIds, newTags },
  };
}

async function validImage(id: number) {
  return Boolean(await db.media.findFirst({ where: { id, kind: "IMAGE", uploadStatus: "READY" }, select: { id: true } }));
}

// Checks that need the database; returns a form error or null.
async function checkReferences(
  data: Parsed,
  formData: FormData,
  options: { courseId: number | null; currentInstructorId: number | null; canPublish: boolean },
): Promise<FormState | null> {
  const { fields } = data;
  if (await db.course.findFirst({ where: { slug: fields.slug, id: { not: options.courseId ?? 0 } }, select: { id: true } })) {
    return fieldError("slug", "Another course already uses this slug.", formData);
  }
  if (data.status === "SCHEDULED" && (!data.publishAt || data.publishAt.getTime() <= Date.now())) {
    return fieldError("publishAtLocal", "Choose a time in the future.", formData);
  }
  if (
    (data.status === "PUBLISHED" || data.status === "SCHEDULED") &&
    isEmptyDocument(fields.description) &&
    !fields.shortDescription
  ) {
    return fieldError("description", "Add a description before publishing.", formData);
  }
  if (fields.categoryId && !(await db.courseCategory.findUnique({ where: { id: fields.categoryId }, select: { id: true } }))) {
    return fieldError("categoryId", "That category no longer exists.", formData);
  }
  if (fields.thumbnailId && !(await validImage(fields.thumbnailId))) {
    return fieldError("thumbnailId", "Choose an image from the media library.", formData);
  }
  if (data.seo.socialImageId && !(await validImage(data.seo.socialImageId))) {
    return fieldError("socialImageId", "Choose an image from the media library.", formData);
  }
  if (fields.instructorId && fields.instructorId !== options.currentInstructorId) {
    const instructors = await listInstructorOptions(options.currentInstructorId);
    if (!instructors.some((i) => i.id === fields.instructorId)) {
      return fieldError("instructorId", "That user cannot teach courses.", formData);
    }
  }
  return null;
}

// Existing tags are kept if they still exist; new names reuse a tag with the
// same slug or are created (only with course-taxonomy.manage).
async function planTags(data: Parsed, canCreate: boolean, formData: FormData) {
  const existing = data.tagIds.length
    ? await db.courseTag.findMany({ where: { id: { in: data.tagIds } }, select: { id: true } })
    : [];
  const ids = new Set(existing.map((t) => t.id));
  const toCreate: { name: string; slug: string }[] = [];
  for (const name of data.newTags) {
    const slug = slugify(name);
    const found = await db.courseTag.findUnique({ where: { slug }, select: { id: true } });
    if (found) ids.add(found.id);
    else if (!canCreate) {
      return { ok: false as const, error: fieldError("tags", "You do not have permission to create new tags.", formData) };
    } else if (!toCreate.some((t) => t.slug === slug)) toCreate.push({ name, slug });
  }
  return { ok: true as const, ids: [...ids], toCreate };
}

async function createTags(tx: Tx, toCreate: { name: string; slug: string }[]) {
  const created: { id: number; name: string }[] = [];
  for (const tag of toCreate) {
    created.push(await tx.courseTag.create({ data: tag, select: { id: true, name: true } }));
  }
  return created;
}

async function setTags(tx: Tx, courseId: number, tagIds: number[]) {
  await tx.courseTagLink.deleteMany({ where: { courseId } });
  if (tagIds.length) await tx.courseTagLink.createMany({ data: tagIds.map((tagId) => ({ courseId, tagId })) });
}

export async function createCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("course.create");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const actor = authz.user;
  const canPublish = can(actor, "course.publish");

  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data } = parsed;

  if (!canTransition(null, data.status, { canEdit: true, canPublish })) {
    return fieldError("status", "You cannot set that status.", formData);
  }
  // Someone who cannot publish teaches their own courses and cannot feature them.
  const instructorId = canPublish ? (data.fields.instructorId ?? actor.id) : actor.id;
  const fields = { ...data.fields, instructorId, featured: canPublish && data.fields.featured };
  const refError = await checkReferences({ ...data, fields }, formData, { courseId: null, currentInstructorId: null, canPublish });
  if (refError) return refError;
  const tagPlan = await planTags(data, can(actor, "course-taxonomy.manage"), formData);
  if (!tagPlan.ok) return tagPlan.error;

  let courseId: number;
  let createdTags: { id: number; name: string }[] = [];
  try {
    courseId = await db.$transaction(async (tx) => {
      createdTags = await createTags(tx, tagPlan.toCreate);
      const course = await tx.course.create({
        data: {
          title: fields.title,
          slug: fields.slug,
          subtitle: fields.subtitle,
          shortDescription: fields.shortDescription,
          description: fields.description as Prisma.InputJsonValue,
          thumbnailId: fields.thumbnailId,
          price: fields.price,
          compareAtPrice: fields.compareAtPrice,
          level: fields.level,
          language: fields.language,
          durationMinutes: fields.durationMinutes,
          badge: fields.badge,
          featured: fields.featured,
          instructorId,
          createdById: actor.id,
          categoryId: fields.categoryId,
          ...statusFields(data.status, { publishAt: data.publishAt }),
        },
        select: { id: true },
      });
      await setTags(tx, course.id, [...tagPlan.ids, ...createdTags.map((t) => t.id)]);
      await upsertSeo("COURSE", course.id, data.seo, tx);
      return course.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fieldError("slug", RACE, formData);
    throw error;
  }

  const details = { title: fields.title };
  await logActivity({ userId: actor.id, action: "course.create", entity: "course", entityId: courseId, details });
  const statusAction = courseStatusActivity(null, data.status);
  if (statusAction) await logActivity({ userId: actor.id, action: statusAction, entity: "course", entityId: courseId, details });
  for (const tag of createdTags) {
    await logActivity({ userId: actor.id, action: "course-tag.create", entity: "course-tag", entityId: tag.id, details: { name: tag.name } });
  }
  refreshCourses();
  // `base` lets a different panel reuse the form: only known prefixes are followed.
  const base = formData.get("basePath") === "/instructor/courses" ? "/instructor/courses" : "/admin/courses";
  redirect(`${base}/${courseId}/edit?created=1`);
}

export async function updateCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = idFrom(formData.get("id"));
  if (!id) return { ok: false, error: NOT_FOUND, values: formValues(formData) };
  const authz = await authorizeCourseAction(id, "course.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const actor = authz.user;
  const canPublish = can(actor, "course.publish");
  const perms = { canEdit: true, canPublish };

  const before = await db.course.findUnique({
    where: { id },
    select: {
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      instructorId: true,
      featured: true,
      price: true,
      thumbnailId: true,
      categoryId: true,
      tags: { select: { tagId: true } },
    },
  });
  if (!before) return { ok: false, error: NOT_FOUND, values: formValues(formData) };
  if (allowedTransitions(before.status, perms).length === 0) return { ok: false, error: LOCKED, values: formValues(formData) };

  const parsed = parseForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data } = parsed;
  if (!canTransition(before.status, data.status, perms)) return fieldError("status", "You cannot set that status.", formData);

  const instructorId = canPublish ? (data.fields.instructorId ?? before.instructorId ?? actor.id) : (before.instructorId ?? actor.id);
  const fields = { ...data.fields, instructorId, featured: canPublish ? data.fields.featured : before.featured };
  const refError = await checkReferences({ ...data, fields }, formData, {
    courseId: id,
    currentInstructorId: before.instructorId,
    canPublish,
  });
  if (refError) return refError;
  const tagPlan = await planTags(data, can(actor, "course-taxonomy.manage"), formData);
  if (!tagPlan.ok) return tagPlan.error;

  const oldSeo = await getSeo("COURSE", id);
  let createdTags: { id: number; name: string }[] = [];
  const finalTagIds = () => [...tagPlan.ids, ...createdTags.map((t) => t.id)];
  try {
    await db.$transaction(async (tx) => {
      createdTags = await createTags(tx, tagPlan.toCreate);
      await tx.course.update({
        where: { id },
        data: {
          title: fields.title,
          slug: fields.slug,
          subtitle: fields.subtitle,
          shortDescription: fields.shortDescription,
          description: fields.description as Prisma.InputJsonValue,
          thumbnailId: fields.thumbnailId,
          price: fields.price,
          compareAtPrice: fields.compareAtPrice,
          level: fields.level,
          language: fields.language,
          durationMinutes: fields.durationMinutes,
          badge: fields.badge,
          featured: fields.featured,
          instructorId,
          categoryId: fields.categoryId,
          ...statusFields(data.status, { publishAt: data.publishAt, publishedAt: before.publishedAt }),
        },
      });
      await setTags(tx, id, finalTagIds());
      await upsertSeo("COURSE", id, data.seo, tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fieldError("slug", RACE, formData);
    throw error;
  }

  const changed: string[] = [];
  if (before.title !== fields.title) changed.push("title");
  if (before.slug !== fields.slug) changed.push("slug");
  if (Number(before.price) !== fields.price) changed.push("price");
  if (before.thumbnailId !== fields.thumbnailId) changed.push("thumbnail");
  if (before.categoryId !== fields.categoryId) changed.push("category");
  if (before.instructorId !== instructorId) changed.push("instructor");
  if (before.featured !== fields.featured) changed.push("featured");
  const oldTags = before.tags.map((t) => t.tagId).sort().join(",");
  if (oldTags !== finalTagIds().sort((a, b) => a - b).join(",")) changed.push("tags");
  if (JSON.stringify(oldSeo) !== JSON.stringify(await getSeo("COURSE", id))) changed.push("seo");
  // The remaining fields are compared coarsely: a save is always logged.
  if (changed.length === 0) changed.push("details");

  const details = { title: fields.title };
  const statusAction = courseStatusActivity(before.status, data.status);
  if (statusAction) await logActivity({ userId: actor.id, action: statusAction, entity: "course", entityId: id, details });
  await logActivity({ userId: actor.id, action: "course.update", entity: "course", entityId: id, details: { ...details, fields: changed } });
  for (const tag of createdTags) {
    await logActivity({ userId: actor.id, action: "course-tag.create", entity: "course-tag", entityId: tag.id, details: { name: tag.name } });
  }
  refreshCourses();
  return { ok: true, message: "Course saved." };
}

// List shortcut for people who can publish: fields `id` and `status`
// (PUBLISHED, DRAFT to take a live course offline, or ARCHIVED).
export async function setCourseStatus(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), status: z.enum(["PUBLISHED", "DRAFT", "ARCHIVED"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id, status } = parsed.data;
  const authz = await authorizeCourseAction(id, "course.publish");
  if (!authz.ok) return authz.result;

  const course = await db.course.findUnique({
    where: { id },
    select: { title: true, description: true, shortDescription: true, status: true, publishedAt: true },
  });
  if (!course) return { ok: false, error: NOT_FOUND };
  if (course.status === status) return { ok: false, error: `The course is already ${status === "DRAFT" ? "a draft" : status.toLowerCase()}.` };
  if (status === "DRAFT" && course.status !== "PUBLISHED" && course.status !== "SCHEDULED" && course.status !== "ARCHIVED") {
    return { ok: false, error: "Only published, scheduled or archived courses can be moved back to draft." };
  }
  if (status === "PUBLISHED" && isEmptyDocument(course.description) && !course.shortDescription) {
    return { ok: false, error: "Add a description before publishing." };
  }

  await db.course.update({ where: { id }, data: statusFields(status, { publishedAt: course.publishedAt }) });
  await logActivity({
    userId: authz.user.id,
    action: courseStatusActivity(course.status, status) ?? "course.update",
    entity: "course",
    entityId: id,
    details: { title: course.title },
  });
  refreshCourses();
  return {
    ok: true,
    message: status === "PUBLISHED" ? "Course published." : status === "ARCHIVED" ? "Course archived." : "Course saved as a draft.",
  };
}

// Copies the course as a draft with its modules, lessons and quiz questions.
// Files are never shared: two rows pointing at one object would mean deleting
// one course breaks the other, so the copy starts with no files, and lessons
// that need a file stay hidden until one is uploaded.
export async function duplicateCourse(formData: FormData): Promise<ActionResult> {
  const id = idFrom(formData.get("id"));
  if (!id) return { ok: false, error: NOT_FOUND };
  const authz = await authorizeCourseAction(id, "course.create");
  if (!authz.ok) return authz.result;
  const actor = authz.user;

  const source = await db.course.findUnique({
    where: { id },
    select: {
      title: true,
      slug: true,
      subtitle: true,
      shortDescription: true,
      description: true,
      thumbnailId: true,
      externalImageId: true,
      price: true,
      compareAtPrice: true,
      level: true,
      language: true,
      durationMinutes: true,
      badge: true,
      instructorId: true,
      categoryId: true,
      tags: { select: { tagId: true } },
      modules: {
        orderBy: { position: "asc" },
        select: {
          title: true,
          description: true,
          position: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              title: true,
              slug: true,
              type: true,
              content: true,
              fileKey: true,
              durationSeconds: true,
              position: true,
              isFreePreview: true,
              published: true,
              quiz: {
                select: {
                  passingScore: true,
                  attemptLimit: true,
                  timeLimitMinutes: true,
                  passFeedback: true,
                  failFeedback: true,
                  shuffleQuestions: true,
                  questions: {
                    orderBy: { position: "asc" },
                    select: { type: true, text: true, explanation: true, points: true, position: true, options: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!source) return { ok: false, error: NOT_FOUND };
  const seo = await getSeo("COURSE", id);

  const slug = await nextFreeSlug(`${source.slug}-copy`, async (candidate) =>
    Boolean(await db.course.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );
  const title = `${source.title} (copy)`.slice(0, 200);
  const canPublish = can(actor, "course.publish");
  let filesNeeded = 0;

  const newId = await db.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        title,
        slug,
        subtitle: source.subtitle,
        shortDescription: source.shortDescription,
        description: source.description === null ? Prisma.DbNull : (source.description as Prisma.InputJsonValue),
        thumbnailId: source.thumbnailId,
        externalImageId: source.externalImageId,
        price: source.price,
        compareAtPrice: source.compareAtPrice,
        level: source.level,
        language: source.language,
        durationMinutes: source.durationMinutes,
        badge: source.badge,
        instructorId: canPublish ? source.instructorId : actor.id,
        createdById: actor.id,
        categoryId: source.categoryId,
        status: "DRAFT",
      },
      select: { id: true },
    });
    await setTags(tx, course.id, source.tags.map((t) => t.tagId));
    if (seo) {
      // A canonical URL points at the original, so it is not copied.
      await upsertSeo(
        "COURSE",
        course.id,
        {
          seoTitle: seo.title ?? undefined,
          metaDescription: seo.metaDescription ?? undefined,
          canonicalUrl: undefined,
          noindex: seo.noindex,
          socialImageId: seo.socialImageId,
        },
        tx,
      );
    }
    for (const sourceModule of source.modules) {
      const createdModule = await tx.courseModule.create({
        data: { courseId: course.id, title: sourceModule.title, description: sourceModule.description, position: sourceModule.position },
        select: { id: true },
      });
      for (const lesson of sourceModule.lessons) {
        const needsFile = (lesson.type === "VIDEO" || lesson.type === "DOCUMENT") && Boolean(lesson.fileKey);
        if (needsFile) filesNeeded++;
        const createdLesson = await tx.lesson.create({
          data: {
            moduleId: createdModule.id,
            courseId: course.id,
            title: lesson.title,
            slug: lesson.slug,
            type: lesson.type,
            content: lesson.content === null ? Prisma.DbNull : (lesson.content as Prisma.InputJsonValue),
            durationSeconds: lesson.durationSeconds,
            position: lesson.position,
            isFreePreview: lesson.isFreePreview,
            // A lesson that had a file would show an empty player: hide it until one is uploaded.
            published: needsFile ? false : lesson.published,
          },
          select: { id: true },
        });
        if (lesson.quiz) {
          const quiz = lesson.quiz;
          await tx.quiz.create({
            data: {
              lessonId: createdLesson.id,
              passingScore: quiz.passingScore,
              attemptLimit: quiz.attemptLimit,
              timeLimitMinutes: quiz.timeLimitMinutes,
              passFeedback: quiz.passFeedback,
              failFeedback: quiz.failFeedback,
              shuffleQuestions: quiz.shuffleQuestions,
              questions: {
                create: quiz.questions.map((q) => ({
                  type: q.type,
                  text: q.text,
                  explanation: q.explanation,
                  points: q.points,
                  position: q.position,
                  options: q.options as Prisma.InputJsonValue,
                })),
              },
            },
          });
        }
      }
    }
    return course.id;
  });

  await logActivity({
    userId: actor.id,
    action: "course.duplicate",
    entity: "course",
    entityId: newId,
    details: { title, from: id },
  });
  refreshCourses();
  const base = formData.get("basePath") === "/instructor/courses" ? "/instructor/courses" : "/admin/courses";
  redirect(`${base}/${newId}/edit?duplicated=1&files=${filesNeeded}`);
}

// Field `redirect` = "list" sends the browser back to the list afterwards.
export async function deleteCourse(formData: FormData): Promise<ActionResult> {
  const id = idFrom(formData.get("id"));
  if (!id) return { ok: false, error: NOT_FOUND };
  const authz = await authorizeCourseAction(id, "course.delete");
  if (!authz.ok) return authz.result;

  const course = await db.course.findUnique({
    where: { id },
    select: {
      title: true,
      introVideoKey: true,
      lessons: { select: { fileKey: true, resources: { select: { fileKey: true } } } },
      _count: { select: { enrolments: true } },
    },
  });
  if (!course) return { ok: false, error: NOT_FOUND };
  if (course._count.enrolments > 0) {
    const n = course._count.enrolments;
    return {
      ok: false,
      error: `This course has ${n} enrolment${n === 1 ? "" : "s"}, so it cannot be deleted. Archive it instead: learners keep their access and records.`,
    };
  }

  const keys = [
    course.introVideoKey,
    ...course.lessons.flatMap((l) => [l.fileKey, ...l.resources.map((r) => r.fileKey)]),
  ].filter((k): k is string => Boolean(k));

  try {
    await db.$transaction(async (tx) => {
      // Modules, lessons, quizzes, reviews and tag links go with the course (cascade).
      await tx.course.delete({ where: { id } });
      await deleteSeo("COURSE", id, tx);
    });
  } catch (error) {
    // Someone enrolled between the check and the delete.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: "This course has learner records, so it cannot be deleted. Archive it instead." };
    }
    throw error;
  }
  await Promise.all(keys.map((key) => removeLessonFile(key)));
  await logActivity({ userId: authz.user.id, action: "course.delete", entity: "course", entityId: id, details: { title: course.title } });
  refreshCourses();
  if (formData.get("redirect") === "list") {
    redirect(`${formData.get("basePath") === "/instructor/courses" ? "/instructor/courses" : "/admin/courses"}?deleted=1`);
  }
  return { ok: true, message: "Course deleted." };
}

const introSchema = z.object({ courseId: z.number().int().positive(), fileToken: z.string().min(1).max(2000) });

// Called by the uploader once the intro video is in the private bucket.
export async function attachIntroVideo(input: z.input<typeof introSchema>): Promise<ActionResult> {
  const parsed = introSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { courseId, fileToken } = parsed.data;
  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;
  const file = readLessonFileToken(fileToken, courseId);
  if (!file || file.kind !== "VIDEO") return { ok: false, error: "This upload has expired. Upload the video again." };

  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true, introVideoKey: true } });
  if (!course) return { ok: false, error: NOT_FOUND };
  if (course.introVideoKey === file.key) return { ok: true, message: "Intro video saved." };
  await db.course.update({
    where: { id: courseId },
    data: { introVideoKey: file.key, introVideoName: file.filename, introVideoMime: file.mimeType, introVideoSize: BigInt(file.size) },
  });
  await removeLessonFile(course.introVideoKey);
  await logActivity({
    userId: authz.user.id,
    action: "course.update",
    entity: "course",
    entityId: courseId,
    details: { title: course.title, fields: ["introVideo"] },
  });
  refreshCourses();
  return { ok: true, message: "Intro video saved." };
}

export async function removeIntroVideo(input: { courseId: number }): Promise<ActionResult> {
  const parsed = z.object({ courseId: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const authz = await authorizeCourseAction(parsed.data.courseId, "course.edit");
  if (!authz.ok) return authz.result;
  const course = await db.course.findUnique({ where: { id: parsed.data.courseId }, select: { title: true, introVideoKey: true } });
  if (!course) return { ok: false, error: NOT_FOUND };
  if (!course.introVideoKey) return { ok: true, message: "There is no intro video." };
  await db.course.update({
    where: { id: parsed.data.courseId },
    data: { introVideoKey: null, introVideoName: null, introVideoMime: null, introVideoSize: null },
  });
  await removeLessonFile(course.introVideoKey);
  await logActivity({
    userId: authz.user.id,
    action: "course.update",
    entity: "course",
    entityId: parsed.data.courseId,
    details: { title: course.title, fields: ["introVideo"] },
  });
  refreshCourses();
  return { ok: true, message: "Intro video removed." };
}
