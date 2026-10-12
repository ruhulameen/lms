import type { Metadata } from "next";
import { LessonPreviewView } from "@/components/admin/lesson-preview-view";

export const metadata: Metadata = { title: "Lesson preview", robots: { index: false } };

export default function LessonPreviewPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  return <LessonPreviewView base="/instructor/courses" params={params} />;
}
