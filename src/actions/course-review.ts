"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from "@/lib/course";
import { formValues, type FormState } from "@/lib/form-state";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveCourseReview } from "@/services/review";
import { getCurrentUser } from "@/services/user";

const HOUR = 60 * 60;

const reviewSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5 stars.").max(5, "Choose a rating from 1 to 5 stars."),
  title: z.string().trim().max(REVIEW_TITLE_MAX, `The title can be up to ${REVIEW_TITLE_MAX} characters.`),
  body: z.string().trim().max(REVIEW_BODY_MAX, `The review can be up to ${REVIEW_BODY_MAX} characters.`),
});

// Create or edit the signed-in learner's review of a course.
export async function submitCourseReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = reviewSchema.safeParse({
    slug: formData.get("slug"),
    rating: formData.get("rating") || 0,
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your review and try again.", values };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again.", values };

  const limited = await checkRateLimit("course-review", [{ scope: "user", value: user.id, limit: 20, windowSeconds: HOUR }]);
  if (limited) return { ok: false, error: limited, values };

  const { slug, rating, title, body } = parsed.data;
  const result = await saveCourseReview(user.id, slug, { rating, title: title || null, body: body || null });
  if (!result.ok) return { ok: false, error: result.error, values };

  revalidatePath(`/courses/${slug}`);
  return {
    ok: true,
    message:
      result.status === "APPROVED"
        ? "Nothing changed. Your review is published."
        : "Thank you. Your review is awaiting approval and will appear on the course page once approved.",
    values,
  };
}
