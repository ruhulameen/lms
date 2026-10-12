import type { Metadata } from "next";
import { LessonEditorView } from "@/components/admin/lesson-editor-view";

export const metadata: Metadata = { title: "Edit lesson" };

export default function LessonEditorPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  return <LessonEditorView base="/instructor/courses" params={params} />;
}
