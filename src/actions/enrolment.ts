"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginHref } from "@/lib/return-path";
import { checkRateLimit } from "@/lib/rate-limit";
import { enrolInFreeCourse } from "@/services/enrolment";
import { getCurrentUser } from "@/services/user";

const HOUR = 60 * 60;

// "Enrol for free" on the course page. Signed-out visitors go to log in and
// come back to the course. Failures return to the course page with a reason
// the page shows (?enrol=...).
export async function enrolInCourse(formData: FormData) {
  const parsed = z.string().trim().min(1).max(200).safeParse(formData.get("slug"));
  if (!parsed.success) redirect("/courses");
  const slug = parsed.data;
  const coursePath = `/courses/${encodeURIComponent(slug)}`;

  const user = await getCurrentUser();
  if (!user) redirect(loginHref(coursePath));

  const limited = await checkRateLimit("enrol", [{ scope: "user", value: user.id, limit: 20, windowSeconds: HOUR }]);
  if (limited) redirect(`${coursePath}?enrol=limited`);

  const result = await enrolInFreeCourse(user, slug);
  if (!result.ok) redirect(`${coursePath}?enrol=unavailable`);

  revalidatePath("/dashboard");
  revalidatePath("/my-courses");
  redirect(`/learn/${encodeURIComponent(result.courseSlug)}`);
}
