import { z } from "zod";
import { courseLevels } from "@/lib/course";
import { richTextSchema } from "@/lib/rich-text";
import { validateSlug } from "@/lib/slug";

// Field rules of the course and lesson forms, shared by the actions and the
// forms. Pure, so client components may import it.

export const COURSE_TITLE_MAX = 200;
export const COURSE_SUBTITLE_MAX = 255;
export const COURSE_SHORT_DESCRIPTION_MAX = 1000;
export const BADGE_MAX = 60;
export const MAX_PRICE = 99999.99;
export const LESSON_TITLE_MAX = 200;
export const MODULE_TITLE_MAX = 150;
export const MODULE_DESCRIPTION_MAX = 1000;
export const RESOURCE_TITLE_MAX = 150;
// Longest lesson length the form accepts: 24 hours.
export const MAX_LESSON_SECONDS = 24 * 60 * 60;

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Choose a valid option.");

const flag = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((v) => v || null);

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const message = validateSlug(value);
    if (message) ctx.addIssue({ code: "custom", message });
  });

// A price in pounds typed by a person: "49", "49.99", "" (= none).
function money(label: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((v, ctx): number | null => {
      if (!v) return null;
      if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} as an amount like 49 or 49.99.` });
        return z.NEVER;
      }
      const n = Number(v);
      if (n > MAX_PRICE) {
        ctx.addIssue({ code: "custom", message: "That amount is too large." });
        return z.NEVER;
      }
      return n;
    });
}

const wholeNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx): number | null => {
      if (!v) return null;
      if (!/^\d{1,6}$/.test(v) || Number(v) > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number up to ${max}.` });
        return z.NEVER;
      }
      return Number(v);
    });

export const courseFieldsSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(COURSE_TITLE_MAX, `Use at most ${COURSE_TITLE_MAX} characters.`),
    slug: slugField,
    subtitle: optionalText(COURSE_SUBTITLE_MAX),
    shortDescription: optionalText(COURSE_SHORT_DESCRIPTION_MAX),
    description: richTextSchema,
    price: money("the price"),
    compareAtPrice: money("the old price"),
    level: z.enum(courseLevels),
    language: z.string().trim().min(1, "Enter a language.").max(50, "Use at most 50 characters."),
    durationHours: wholeNumber("Hours", 999),
    durationMins: wholeNumber("Minutes", 59),
    badge: optionalText(BADGE_MAX),
    instructorId: optionalId,
    categoryId: optionalId,
    thumbnailId: optionalId,
    featured: flag,
  })
  .transform((v, ctx) => {
    const price = v.price ?? 0;
    if (v.compareAtPrice !== null && v.compareAtPrice <= price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "The old price must be higher than the price." });
    }
    const total = (v.durationHours ?? 0) * 60 + (v.durationMins ?? 0);
    return {
      title: v.title,
      slug: v.slug,
      subtitle: v.subtitle,
      shortDescription: v.shortDescription,
      description: v.description,
      compareAtPrice: v.compareAtPrice,
      level: v.level,
      language: v.language,
      badge: v.badge,
      instructorId: v.instructorId,
      categoryId: v.categoryId,
      thumbnailId: v.thumbnailId,
      featured: v.featured,
      price,
      durationMinutes: total > 0 ? total : null,
    };
  });

export type CourseFields = z.output<typeof courseFieldsSchema>;

// Whole seconds from the minutes and seconds inputs of the lesson form.
export const lessonFieldsSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(LESSON_TITLE_MAX, `Use at most ${LESSON_TITLE_MAX} characters.`),
    slug: slugField,
    isFreePreview: flag,
    published: flag,
    durationMinutes: wholeNumber("Minutes", 1440),
    durationSeconds: wholeNumber("Seconds", 59),
    content: richTextSchema.optional(),
  })
  .transform((v, ctx) => {
    const total = (v.durationMinutes ?? 0) * 60 + (v.durationSeconds ?? 0);
    if (total > MAX_LESSON_SECONDS) {
      ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "A lesson can be at most 24 hours long." });
    }
    return {
      title: v.title,
      slug: v.slug,
      isFreePreview: v.isFreePreview,
      published: v.published,
      content: v.content,
      durationSeconds: total > 0 ? total : null,
    };
  });

export const moduleFieldsSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(MODULE_TITLE_MAX, `Use at most ${MODULE_TITLE_MAX} characters.`),
  description: optionalText(MODULE_DESCRIPTION_MAX),
});

export const resourceTitleSchema = z.string().trim().min(1, "Enter a title.").max(RESOURCE_TITLE_MAX, `Use at most ${RESOURCE_TITLE_MAX} characters.`);

// Splits stored minutes into the hours and minutes inputs.
export function splitMinutes(total: number | null | undefined) {
  if (!total || total <= 0) return { hours: "", minutes: "" };
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}

export function splitSeconds(total: number | null | undefined) {
  if (!total || total <= 0) return { minutes: "", seconds: "" };
  return { minutes: String(Math.floor(total / 60)), seconds: String(total % 60) };
}

// The order the builder sends: modules in order, each with its lesson ids in order.
export const curriculumOrderSchema = z.object({
  courseId: z.number().int().positive(),
  modules: z
    .array(z.object({ id: z.number().int().positive(), lessonIds: z.array(z.number().int().positive()).max(500) }))
    .max(200),
});
export type CurriculumOrder = z.input<typeof curriculumOrderSchema>;

// The activity action for a course status change, or null when there is none.
export function courseStatusActivity(
  from: "DRAFT" | "PENDING_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" | null,
  to: "DRAFT" | "PENDING_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
) {
  if (from === to) return null;
  switch (to) {
    case "PENDING_REVIEW":
      return "course.submit-for-review";
    case "PUBLISHED":
      return "course.publish";
    case "SCHEDULED":
      return "course.schedule";
    case "ARCHIVED":
      return "course.archive";
    case "DRAFT":
      return from === "PUBLISHED" || from === "SCHEDULED" ? "course.unpublish" : null;
  }
}
