"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { deleteReview, moderateReview, type ModerationResult } from "@/services/review-moderation";
import { authorizeAction } from "@/services/user";

// Review moderation (review.moderate). What the public sees changes, so the
// course page, the home and about sliders and the admin lists are refreshed.

const idSchema = z.coerce.number().int().positive();

function refresh(courseSlug: string) {
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/courses", "layout");
  revalidatePath("/");
  revalidatePath("/about");
}

async function run(formData: FormData, act: (id: number, actorId: number) => Promise<ModerationResult>): Promise<ActionResult> {
  const id = idSchema.safeParse(formData.get("reviewId"));
  if (!id.success) return { ok: false, error: "This review no longer exists." };
  const authz = await authorizeAction("review.moderate");
  if (!authz.ok) return authz.result;

  const result = await act(id.data, authz.user.id);
  if (!result.ok) return result;
  refresh(result.courseSlug);
  return { ok: true, message: result.message };
}

export async function approveReview(formData: FormData) {
  return run(formData, (id, actor) => moderateReview(id, "APPROVED", actor));
}

export async function rejectReview(formData: FormData) {
  return run(formData, (id, actor) => moderateReview(id, "REJECTED", actor));
}

export async function deleteReviewAction(formData: FormData) {
  return run(formData, deleteReview);
}
