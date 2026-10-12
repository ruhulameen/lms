"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { authorizeCourseAction } from "@/services/course-access";
import { assignCourse, cancelEnrolment, reactivateEnrolment } from "@/services/learners";

// Enrolment management by staff (enrolment.manage, on a course they manage).
// Learners joining a free course themselves is src/actions/enrolment.ts.

const idSchema = z.coerce.number().int().positive();

function refresh() {
  revalidatePath("/admin/enrolments", "layout");
  revalidatePath("/admin/learners", "layout");
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/admin");
  revalidatePath("/instructor", "layout");
  revalidatePath("/my-courses");
  revalidatePath("/dashboard");
}

// Assign a course to a learner (paid courses are given out this way until payments exist).
export async function assignEnrolment(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = idSchema.safeParse(formData.get("userId"));
  const courseId = idSchema.safeParse(formData.get("courseId"));
  if (!userId.success) return { ok: false, error: "Choose a learner.", fieldErrors: { userId: ["Choose a learner."] }, values: formValues(formData) };
  if (!courseId.success) return { ok: false, error: "Choose a course.", fieldErrors: { courseId: ["Choose a course."] }, values: formValues(formData) };
  const authz = await authorizeCourseAction(courseId.data, "enrolment.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const result = await assignCourse(authz.user.id, userId.data, courseId.data);
  if (!result.ok) return { ok: false, error: result.error, values: formValues(formData) };
  refresh();
  return {
    ok: true,
    message: result.reactivated ? `${result.learner}'s enrolment in ${result.course} is active again.` : `${result.learner} now has access to ${result.course}.`,
  };
}

async function courseOfEnrolment(enrolmentId: number) {
  return (await db.enrolment.findUnique({ where: { id: enrolmentId }, select: { courseId: true } }))?.courseId ?? null;
}

export async function cancelEnrolmentAction(formData: FormData): Promise<ActionResult> {
  const enrolmentId = idSchema.safeParse(formData.get("enrolmentId"));
  if (!enrolmentId.success) return { ok: false, error: "This enrolment no longer exists." };
  const courseId = await courseOfEnrolment(enrolmentId.data);
  if (!courseId) return { ok: false, error: "This enrolment no longer exists." };
  const authz = await authorizeCourseAction(courseId, "enrolment.manage");
  if (!authz.ok) return authz.result;

  const result = await cancelEnrolment(authz.user.id, enrolmentId.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: `${result.learner}'s enrolment in ${result.course} is cancelled.` };
}

export async function reactivateEnrolmentAction(formData: FormData): Promise<ActionResult> {
  const enrolmentId = idSchema.safeParse(formData.get("enrolmentId"));
  if (!enrolmentId.success) return { ok: false, error: "This enrolment no longer exists." };
  const courseId = await courseOfEnrolment(enrolmentId.data);
  if (!courseId) return { ok: false, error: "This enrolment no longer exists." };
  const authz = await authorizeCourseAction(courseId, "enrolment.manage");
  if (!authz.ok) return authz.result;

  const result = await reactivateEnrolment(authz.user.id, enrolmentId.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: `${result.learner}'s enrolment in ${result.course} is active again.` };
}
