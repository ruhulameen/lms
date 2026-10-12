import type { Metadata } from "next";
import { CoursePreviewView } from "@/components/admin/course-preview-view";

export const metadata: Metadata = { title: "Course preview", robots: { index: false } };

export default function CoursePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <CoursePreviewView base="/admin/courses" params={params} />;
}
