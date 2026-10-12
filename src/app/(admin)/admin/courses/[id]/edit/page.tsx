import type { Metadata } from "next";
import { CourseEditView } from "@/components/admin/course-edit-view";
import type { SearchParams } from "@/lib/table-params";

export const metadata: Metadata = { title: "Edit course" };

export default function CourseEditPage(props: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  return <CourseEditView base="/admin/courses" {...props} />;
}
