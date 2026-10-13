import { ScormPlayer } from "@/components/learn/scorm-player";
import { emptyScormProgress } from "@/lib/scorm";
import { getScormLaunch } from "@/services/scorm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { QuizLesson } from "@/components/learn/quiz-lesson";
import { RichText } from "@/components/site/rich-text";
import { lessonTypeLabels } from "@/lib/course";
import { isEmptyDocument, sanitizeDocument, type RichTextDocument } from "@/lib/rich-text";
import { parseRouteId } from "@/lib/route-id";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseHeading, getLessonForEdit, getLessonNeighbours } from "@/services/course-admin";
import { getLessonFileUrl, getLessonResourceUrl } from "@/services/lesson-access";
import { formatBytes } from "@/lib/media-types";

// A lesson as a learner would meet it, for staff, whatever its published state.
export async function LessonPreviewView({ base, params }: { base: string; params: Promise<{ id: string; lessonId: string }> }) {
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

  const fileLink = lesson.fileName && lesson.type !== "SCORM" ? await getLessonFileUrl(user, lessonId) : null;
  const scorm = lesson.type === "SCORM" ? await getScormLaunch(lessonId) : null;
  const resources = await Promise.all(
    lesson.resources.map(async (r) => ({ ...r, link: await getLessonResourceUrl(user, r.id) })),
  );
  let content: RichTextDocument | null = null;
  try {
    content = lesson.content ? sanitizeDocument(lesson.content) : null;
  } catch {
    content = null;
  }
  const hasContent = content !== null && !isEmptyDocument(content);

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-amber-100 px-4 py-2.5 text-sm text-amber-950">
        <span>
          <strong>Preview — not published.</strong> {lesson.published ? "This lesson is visible to learners." : "This lesson is hidden from learners."}
        </span>
        <span className="flex gap-4">
          <Link href={`${base}/${courseId}/curriculum/lessons/${lessonId}`} className="font-medium underline">
            Back to the lesson editor
          </Link>
          <Link href={`${base}/${courseId}/preview`} className="font-medium underline">
            Course preview
          </Link>
        </span>
      </div>
      <div className="min-h-[60vh] bg-slate-50 text-gray-800">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-xs text-gray-500">
            {course.title} · {lesson.module.title} · {lessonTypeLabels[lesson.type]}
          </p>
          <h1 className="mt-1 mb-6 text-2xl font-extrabold text-navy">{lesson.title}</h1>

          {lesson.type === "VIDEO" &&
            (fileLink && fileLink.ok ? (
              <video controls preload="metadata" src={fileLink.url} className="mb-6 aspect-video w-full rounded-xl bg-black" aria-label="Lesson video" />
            ) : (
              <p className="mb-6 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">No video has been uploaded for this lesson.</p>
            ))}

          {lesson.type === "SCORM" &&
            (scorm ? (
              <div className="mb-6">
                <ScormPlayer
                  lessonId={lesson.id}
                  title={lesson.title}
                  src={scorm.src}
                  initial={emptyScormProgress}
                  learner={{ id: user.id, name: user.name }}
                  masteryScore={scorm.masteryScore}
                  launchData={scorm.launchData}
                  track={false}
                />
                <p className="mt-2 text-xs text-gray-500">As a learner sees it, starting from the beginning. Nothing you do here is saved.</p>
              </div>
            ) : (
              <p className="mb-6 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">No package has been uploaded for this lesson.</p>
            ))}

          {lesson.type === "DOCUMENT" &&
            (fileLink && fileLink.ok ? (
              <a href={fileLink.url} className="mb-6 flex items-center gap-3 rounded-xl border bg-white p-4 text-sm hover:bg-slate-50">
                <Download className="size-5 text-blue-600" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{fileLink.filename}</span>
                <span className="text-xs text-gray-500">{formatBytes(fileLink.size)}</span>
              </a>
            ) : (
              <p className="mb-6 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">No document has been uploaded for this lesson.</p>
            ))}

          {lesson.type === "QUIZ" && (
            <div className="mb-6">
              <QuizLesson lessonId={lessonId} lessonTitle={lesson.title} enrolmentId={null} completed={false} staff />
            </div>
          )}

          {hasContent && (
            <div className="rounded-xl border bg-white p-6">
              <RichText doc={content} />
            </div>
          )}
          {lesson.type === "TEXT" && !hasContent && <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">This lesson has no content yet.</p>}

          {resources.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-bold text-navy">Resources</h2>
              <ul className="divide-y rounded-xl border bg-white">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    {r.link.ok && (
                      <a href={r.link.url} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                        <Download className="size-4" aria-hidden /> Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex justify-between text-sm">
            {neighbours.previous ? (
              <Link href={`${base}/${courseId}/preview/lessons/${neighbours.previous.id}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                <ChevronLeft className="size-4" aria-hidden /> {neighbours.previous.title}
              </Link>
            ) : (
              <span />
            )}
            {neighbours.next && (
              <Link href={`${base}/${courseId}/preview/lessons/${neighbours.next.id}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                {neighbours.next.title} <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
