import type { Metadata } from "next";
import { CourseLearnersView } from "@/components/admin/course-learners-view";
import type { SearchParams } from "@/lib/table-params";

export const metadata: Metadata = { title: "Course learners" };

export default function CourseLearnersPage(props: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  return <CourseLearnersView base="/instructor/courses" {...props} />;
}
