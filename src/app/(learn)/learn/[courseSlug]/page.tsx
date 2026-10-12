import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/user";
import { getResumeLessonSlug } from "@/services/learning";

// /learn/<course> opens the lesson the learner should continue with.
export default async function LearnCoursePage({ params }: PageProps<"/learn/[courseSlug]">) {
  const { courseSlug } = await params;
  const user = await getCurrentUser();
  const lessonSlug = await getResumeLessonSlug(user, courseSlug);
  if (!lessonSlug) redirect(`/courses/${courseSlug}`);
  redirect(`/learn/${courseSlug}/${lessonSlug}`);
}
