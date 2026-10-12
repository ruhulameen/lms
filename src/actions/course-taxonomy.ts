"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { slugify, validateSlug } from "@/lib/slug";
import { logActivity } from "@/services/activity";
import { authorizeAction } from "@/services/user";

const nameSchema = z.string().trim().min(1, "Enter a name.").max(100, "Use at most 100 characters.");
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const message = validateSlug(value);
    if (message) ctx.addIssue({ code: "custom", message });
  });
const idSchema = z.coerce.number().int().positive();

const categorySchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: z
    .string()
    .trim()
    .max(1000, "Use at most 1000 characters.")
    .optional()
    .transform((v) => v || null),
});
const tagSchema = z.object({ name: nameSchema, slug: slugSchema });

function refresh() {
  // Category and tag names show on the public catalogue and in the course editor.
  revalidatePath("/courses", "layout");
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/instructor/courses", "layout");
}

function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formValues(formData),
  };
}

function slugTaken(formData: FormData): FormState {
  const message = "Another item already uses this slug.";
  return { ok: false, error: message, fieldErrors: { slug: [message] }, values: formValues(formData) };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// An empty slug field falls back to the name, so scripts and the no-JS form still work.
function withSlug(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const slug = String(raw.slug ?? "").trim() || slugify(String(raw.name ?? ""));
  return { ...raw, slug };
}

export async function createCourseCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("course-taxonomy.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = categorySchema.safeParse(withSlug(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    const category = await db.courseCategory.create({ data: parsed.data, select: { id: true } });
    await logActivity({ userId: authz.user.id, action: "course-category.create", entity: "course-category", entityId: category.id, details: { name: parsed.data.name } });
  } catch (error) {
    if (isUniqueViolation(error)) return slugTaken(formData);
    throw error;
  }
  refresh();
  return { ok: true, message: "Category created." };
}

export async function updateCourseCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("course-taxonomy.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = categorySchema.safeParse(withSlug(formData));
  if (!id.success) return { ok: false, error: "This category no longer exists.", values: formValues(formData) };
  if (!parsed.success) return invalid(parsed.error, formData);

  const before = await db.courseCategory.findUnique({ where: { id: id.data }, select: { name: true, slug: true } });
  if (!before) return { ok: false, error: "This category no longer exists.", values: formValues(formData) };
  try {
    await db.courseCategory.update({ where: { id: id.data }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return slugTaken(formData);
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "course-category.update",
    entity: "course-category",
    entityId: id.data,
    details: { from: before.name, to: parsed.data.name },
  });
  refresh();
  return { ok: true, message: "Category saved." };
}

// Courses in the category stay and become uncategorised (the relation is SetNull).
export async function deleteCourseCategory(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("course-taxonomy.manage");
  if (!authz.ok) return authz.result;
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "This category no longer exists." };

  const category = await db.courseCategory.findUnique({
    where: { id: id.data },
    select: { name: true, _count: { select: { courses: true } } },
  });
  if (!category) return { ok: false, error: "This category no longer exists." };
  await db.courseCategory.delete({ where: { id: id.data } });
  await logActivity({
    userId: authz.user.id,
    action: "course-category.delete",
    entity: "course-category",
    entityId: id.data,
    details: { name: category.name, courses: category._count.courses },
  });
  refresh();
  return { ok: true, message: "Category deleted." };
}

export async function createCourseTag(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("course-taxonomy.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = tagSchema.safeParse(withSlug(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    const tag = await db.courseTag.create({ data: parsed.data, select: { id: true } });
    await logActivity({ userId: authz.user.id, action: "course-tag.create", entity: "course-tag", entityId: tag.id, details: { name: parsed.data.name } });
  } catch (error) {
    if (isUniqueViolation(error)) return slugTaken(formData);
    throw error;
  }
  refresh();
  return { ok: true, message: "Tag created." };
}

export async function updateCourseTag(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("course-taxonomy.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = tagSchema.safeParse(withSlug(formData));
  if (!id.success) return { ok: false, error: "This tag no longer exists.", values: formValues(formData) };
  if (!parsed.success) return invalid(parsed.error, formData);

  const before = await db.courseTag.findUnique({ where: { id: id.data }, select: { name: true } });
  if (!before) return { ok: false, error: "This tag no longer exists.", values: formValues(formData) };
  try {
    await db.courseTag.update({ where: { id: id.data }, data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) return slugTaken(formData);
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "course-tag.update",
    entity: "course-tag",
    entityId: id.data,
    details: { from: before.name, to: parsed.data.name },
  });
  refresh();
  return { ok: true, message: "Tag saved." };
}

// Removes the tag from its courses (the join rows cascade).
export async function deleteCourseTag(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("course-taxonomy.manage");
  if (!authz.ok) return authz.result;
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "This tag no longer exists." };

  const tag = await db.courseTag.findUnique({ where: { id: id.data }, select: { name: true, _count: { select: { courses: true } } } });
  if (!tag) return { ok: false, error: "This tag no longer exists." };
  await db.courseTag.delete({ where: { id: id.data } });
  await logActivity({
    userId: authz.user.id,
    action: "course-tag.delete",
    entity: "course-tag",
    entityId: id.data,
    details: { name: tag.name, courses: tag._count.courses },
  });
  refresh();
  return { ok: true, message: "Tag deleted." };
}
