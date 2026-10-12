import type { Metadata } from "next";
import { CourseListView } from "@/components/admin/course-list-view";
import type { SearchParams } from "@/lib/table-params";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <CourseListView base="/instructor/courses" searchParams={searchParams} />;
}
