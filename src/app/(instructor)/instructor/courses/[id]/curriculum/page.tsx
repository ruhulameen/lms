import type { Metadata } from "next";
import { CourseCurriculumView } from "@/components/admin/course-curriculum-view";

export const metadata: Metadata = { title: "Curriculum" };

export default function CourseCurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  return <CourseCurriculumView base="/instructor/courses" params={params} />;
}
