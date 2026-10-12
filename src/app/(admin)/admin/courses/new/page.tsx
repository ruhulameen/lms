import type { Metadata } from "next";
import { CourseNewView } from "@/components/admin/course-new-view";

export const metadata: Metadata = { title: "New course" };

export default function CourseNewPage() {
  return <CourseNewView base="/admin/courses" />;
}
