import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { deleteLesson } from "@/actions/course-curriculum";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { CourseSubnav } from "@/components/admin/course-subnav";
import { LessonFileSection } from "@/components/admin/lesson-file-section";
import { LessonForm } from "@/components/admin/lesson-form";
import { LessonResources } from "@/components/admin/lesson-resources";
import { QuizBuilder } from "@/components/admin/quiz-builder";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { lessonNeedsFile, lessonTypeLabels } from "@/lib/course";
import { parseRouteId } from "@/lib/route-id";
import { emptyDocumentCopy, sanitizeDocument, type RichTextDocument } from "@/lib/rich-text";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseHeading, getLessonForEdit, getLessonNeighbours } from "@/services/course-admin";
import { getLessonFileUrl, getLessonResourceUrl } from "@/services/lesson-access";
import { getQuizForEdit } from "@/services/quiz";
import { can } from "@/services/user";

export async function LessonEditorView({ base, params }: { base: string; params: Promise<{ id: string; lessonId: string }> }) {
  const { id: rawId, lessonId: rawLessonId } = await params;
  const courseId = parseRouteId(rawId);
  const lessonId = parseRouteId(rawLessonId);
  if (!courseId || !lessonId) notFound();
  const { user } = await assertCourseAccess(courseId, "course.view");

  const [course, lesson, neighbours] = await Promise.all([
    getCourseHeading(courseId),
    getLessonForEdit(courseId, lessonId),
    getLessonNeighbours(courseId, lessonId),
  ]);
  if (!course || !lesson) notFound();

  const canEdit = can(user, "course.edit");
  // Staff preview links: short-lived, made on the server for this request.
  const fileLink = lesson.fileName && (lesson.type === "VIDEO" || lesson.type === "DOCUMENT") ? await getLessonFileUrl(user, lessonId) : null;
  const resources = await Promise.all(
    lesson.resources.map(async (r) => {
      const link = await getLessonResourceUrl(user, r.id);
      return { id: r.id, title: r.title, fileName: r.fileName, size: r.fileSize, url: link.ok ? link.url : null };
    }),
  );

  let content: RichTextDocument | null = null;
  if (lesson.content) {
    try {
      content = sanitizeDocument(lesson.content);
    } catch {
      content = emptyDocumentCopy();
    }
  }
  const quiz = lesson.type === "QUIZ" ? await getQuizForEdit(courseId, lessonId) : null;
  const hasFile = lessonNeedsFile(lesson.type) ? Boolean(lesson.fileName) : null;

  return (
    <>
      <PageHeader
        title={lesson.title}
        description={`${lessonTypeLabels[lesson.type]} lesson in "${lesson.module.title}" · ${course.title}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`${base}/${courseId}/curriculum`} />}>
              <ChevronLeft aria-hidden /> Curriculum
            </Button>
            <Button variant="outline" render={<Link href={`${base}/${courseId}/preview/lessons/${lessonId}`} />}>
              <Eye aria-hidden /> Preview
            </Button>
            {canEdit && (
              <ConfirmDialog
                action={deleteLesson}
                fields={{ courseId: String(courseId), lessonId: String(lessonId), redirectTo: `${base}/${courseId}/curriculum` }}
                title="Delete this lesson?"
                description="The lesson, its file, resources and any learner progress on it are deleted for good."
                trigger={<><Trash2 aria-hidden /> Delete</>}
                triggerVariant="destructive"
                confirmLabel="Delete lesson"
                destructive
              />
            )}
          </>
        }
      />
      <CourseSubnav courseId={courseId} basePath={base} active="curriculum" />
      <div className="grid max-w-4xl gap-5">
        <LessonForm
          courseId={courseId}
          canEdit={canEdit}
          lesson={{
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            type: lesson.type,
            content,
            isFreePreview: lesson.isFreePreview,
            published: lesson.published,
            durationSeconds: lesson.durationSeconds,
            hasFile,
            questionCount: quiz ? quiz.questions.length : null,
          }}
        />
        {quiz && (
          <QuizBuilder
            courseId={courseId}
            lessonId={lessonId}
            basePath={base}
            canEdit={canEdit}
            settings={quiz.settings}
            questions={quiz.questions}
            attemptCount={quiz.attemptCount}
          />
        )}
        {(lesson.type === "VIDEO" || lesson.type === "DOCUMENT" || lesson.type === "SCORM") && (
          <LessonFileSection
            courseId={courseId}
            lessonId={lessonId}
            type={lesson.type}
            file={lesson.fileName ? { name: lesson.fileName, size: lesson.fileSize ?? 0, mimeType: lesson.fileMimeType ?? "" } : null}
            // A package is not downloaded: it is opened from the lesson preview.
            previewUrl={lesson.type !== "SCORM" && fileLink && fileLink.ok ? fileLink.url : null}
            canEdit={canEdit}
          />
        )}
        <LessonResources courseId={courseId} lessonId={lessonId} resources={resources} canEdit={canEdit} />
        <div className="flex justify-between text-sm">
          {neighbours.previous ? (
            <Link href={`${base}/${courseId}/curriculum/lessons/${neighbours.previous.id}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
              <ChevronLeft className="size-4" aria-hidden /> {neighbours.previous.title}
            </Link>
          ) : (
            <span />
          )}
          {neighbours.next && (
            <Link href={`${base}/${courseId}/curriculum/lessons/${neighbours.next.id}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
              {neighbours.next.title} <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
