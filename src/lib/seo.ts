import { z } from "zod";

export const SEO_TITLE_HINT = 60;
export const META_DESCRIPTION_HINT = 160;

// Fields <SeoFields> submits; actions parse them with this and pass the result
// to upsertSeo(). The length limits are generous: the hints are advice.
export const seoFieldsSchema = z.object({
  seoTitle: z.string().trim().max(120, "Use at most 120 characters.").optional(),
  metaDescription: z.string().trim().max(320, "Use at most 320 characters.").optional(),
  canonicalUrl: z
    .string()
    .trim()
    .max(2000, "Use at most 2000 characters.")
    .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full URL starting with http:// or https://")
    .optional(),
  noindex: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  socialImageId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Choose a valid image."),
});

export type SeoFieldsInput = z.output<typeof seoFieldsSchema>;
