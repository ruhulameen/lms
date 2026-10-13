import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, Download, FileText, Lock, PartyPopper } from "lucide-react";
import { DownloadButton } from "@/components/learn/download-button";
import { CompleteButton } from "@/components/learn/complete-button";
import { LearnShell } from "@/components/learn/learn-shell";
import { LessonSidebar } from "@/components/learn/lesson-sidebar";
import { QuizLesson } from "@/components/learn/quiz-lesson";
import { ScormPlayer } from "@/components/learn/scorm-player";
import { VideoPlayer } from "@/components/learn/video-player";
import { RichText } from "@/components/site/rich-text";
import { formatLessonDuration, lessonTypeLabels } from "@/lib/course";
import { isEmptyDocument } from "@/lib/rich-text";
import { loginHref } from "@/lib/return-path";
import { cn } from "@/lib/utils";
import { getPlayerContext, touchLastLesson, type PlayerLesson } from "@/services/learning";
import { emptyScormProgress } from "@/lib/scorm";
import { getLessonFileUrl } from "@/services/lesson-access";
import { getScormLaunch, getScormProgress } from "@/services/scorm";
import { getCurrentUser } from "@/services/user";

const sizeFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${sizeFormatter.format(bytes / 1024)} KB`;
  return `${sizeFormatter.format(bytes / (1024 * 1024))} MB`;
}

const emptyFile = (message: string) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
    <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-slate-100 text-gray-400">
      <FileText className="size-7" aria-hidden />
    </span>
    <p className="text-sm text-gray-500">{message}</p>
  </div>
);

function NavLink({ lesson, courseSlug, direction }: { lesson: PlayerLesson | null; courseSlug: string; direction: "previous" | "next" }) {
  const base =
    "flex min-w-0 items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-blue-600/40";
  const previous = direction === "previous";
  if (!lesson) return <span />;
  const content = (
    <>
      {previous && <ArrowLeft className="size-4 shrink-0" aria-hidden />}
      <span className="min-w-0">
        <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">{previous ? "Previous" : "Next"}</span>
        <span className="block truncate">{lesson.title}</span>
      </span>
      {!previous && <ArrowRight className="size-4 shrink-0" aria-hidden />}
    </>
  );
  if (!lesson.accessible) {
    return (
      <Link
        href={`/courses/${courseSlug}`}
        className={cn(base, "border-gray-200 bg-white text-gray-400 hover:bg-gray-50", !previous && "justify-end text-right")}
      >
        <Lock className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[10px] font-bold tracking-wider uppercase">{previous ? "Previous" : "Next"} · Locked</span>
          <span className="block truncate">{lesson.title}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={`/learn/${courseSlug}/${lesson.slug}`}
      className={cn(base, "border-gray-200 bg-white text-navy hover:border-blue-300 hover:bg-blue-50", !previous && "justify-end text-right")}
    >
      {content}
    </Link>
  );
}

export default async function LessonPage({ params }: PageProps<"/learn/[courseSlug]/[lessonSlug]">) {
  const { courseSlug, lessonSlug } = await params;
  const user = await getCurrentUser();
  const context = await getPlayerContext(user, courseSlug, lessonSlug);

  if (context.status === "not-found") notFound();
  // Signed out: log in and come back. Signed in without access: the course page.
  if (context.status === "denied") {
    redirect(context.signedIn ? `/courses/${courseSlug}` : loginHref(`/learn/${courseSlug}/${lessonSlug}`));
  }

  const { course, enrolment, staff, modules, lesson, previous, next } = context;
  if (enrolment) await touchLastLesson(enrolment.id, lesson.id);

  // Signed links are made here, on the server, for this viewer only.
  const isPdf = lesson.fileMimeType === "application/pdf";
  const needsLink = lesson.hasFile && (lesson.type === "VIDEO" || (lesson.type === "DOCUMENT" && isPdf));
  const link = needsLink ? await getLessonFileUrl(user, lesson.id, { mode: "play" }) : null;

  // A SCORM lesson: where its package starts, and where this learner left it.
  const scorm = lesson.type === "SCORM" ? await getScormLaunch(lesson.id) : null;
  const scormProgress = scorm && enrolment ? await getScormProgress(enrolment.id, lesson.id) : emptyScormProgress;

  const tracked = enrolment !== null;
  const hasNotes = lesson.content != null && !isEmptyDocument(lesson.content);
  const length = formatLessonDuration(lesson.durationSeconds);
  const courseDone = enrolment?.status === "COMPLETED" || (tracked && enrolment.progressPercent === 100);
  const finishedLastLesson = tracked && !next && lesson.completed && courseDone;

  let body: React.ReactNode;
  if (lesson.type === "VIDEO") {
    body = !lesson.hasFile
      ? emptyFile("The video for this lesson has not been added yet.")
      : link?.ok
        ? (
          <VideoPlayer
            lessonId={lesson.id}
            title={lesson.title}
            src={link.url}
            startAt={lesson.startAt}
            durationSeconds={lesson.durationSeconds}
            track={tracked}
            completed={lesson.completed}
          />
        )
        : emptyFile("The video is not available right now. Try again in a moment.");
  } else if (lesson.type === "TEXT") {
    body = hasNotes ? (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <RichText doc={lesson.content} className="[&>:first-child]:mt-0 [&>:last-child]:mb-0" />
      </div>
    ) : (
      emptyFile("This lesson has no content yet.")
    );
  } else if (lesson.type === "DOCUMENT") {
    body = !lesson.hasFile ? (
      emptyFile("The document for this lesson has not been added yet.")
    ) : (
      <div className="space-y-4">
        {isPdf && link?.ok && (
          <iframe
            src={link.url}
            title={lesson.fileName ?? lesson.title}
            className="h-[70vh] w-full rounded-2xl border border-gray-200 bg-white"
          />
        )}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-navy">{lesson.fileName}</p>
            {lesson.fileSize !== null && <p className="text-xs text-gray-500">{formatSize(lesson.fileSize)}</p>}
          </div>
          <DownloadButton kind="lesson" id={lesson.id} />
        </div>
      </div>
    );
  } else if (lesson.type === "SCORM") {
    body = scorm ? (
      <ScormPlayer
        lessonId={lesson.id}
        title={lesson.title}
        src={scorm.src}
        initial={scormProgress}
        learner={{ id: user?.id ?? 0, name: user?.name ?? "Guest" }}
        masteryScore={scorm.masteryScore}
        launchData={scorm.launchData}
        track={tracked}
      />
    ) : (
      emptyFile("The course package for this lesson has not been added yet.")
    );
  } else {
    body = (
      <QuizLesson
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        enrolmentId={enrolment?.id ?? null}
        completed={lesson.completed}
        staff={staff}
      />
    );
  }

  return (
    <LearnShell
      courseTitle={course.title}
      courseHref={`/courses/${course.slug}`}
      backHref={user ? "/my-courses" : `/courses/${course.slug}`}
      backLabel={user ? "My courses" : "Course page"}
      progress={enrolment ? enrolment.progressPercent : null}
      sidebar={<LessonSidebar courseSlug={course.slug} currentId={lesson.id} modules={modules} />}
    >
      {!tracked && (
        <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {staff
            ? "You are viewing this lesson as course staff. Progress is not saved."
            : "You are previewing a free lesson. "}
          {!staff && (
            <Link href={`/courses/${course.slug}`} className="font-bold underline">
              See the course
            </Link>
          )}
          {!staff && " to enrol and keep track of your progress."}
        </p>
      )}

      <p className="mb-2 text-xs font-bold tracking-wider text-blue-600 uppercase">
        {lessonTypeLabels[lesson.type]}
        {length && ` · ${length}`}
      </p>
      <h1 className="mb-6 text-2xl leading-tight font-extrabold text-navy">{lesson.title}</h1>

      {body}

      {lesson.type !== "TEXT" && hasNotes && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-navy">About this lesson</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <RichText doc={lesson.content} className="[&>:first-child]:mt-0 [&>:last-child]:mb-0" />
          </div>
        </section>
      )}

      {lesson.resources.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-navy">Resources</h2>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {lesson.resources.map((resource) => (
              <li key={resource.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Download className="size-4 shrink-0 text-blue-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{resource.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {resource.fileName} · {formatSize(resource.fileSize)}
                  </p>
                </div>
                <DownloadButton kind="resource" id={resource.id} className="bg-white text-blue-600 ring-1 ring-blue-200 hover:bg-blue-50" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {finishedLastLesson && (
        <section className="mt-8 rounded-2xl bg-linear-to-br from-blue-600 to-blue-900 p-8 text-center text-white">
          <PartyPopper className="mx-auto mb-3 size-10" aria-hidden />
          <h2 className="mb-2 text-2xl font-extrabold">Course complete</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-blue-100">
            Well done, you have finished every lesson of {course.title}.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/my-certificates"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
            >
              <Award className="size-4" aria-hidden /> My certificates
            </Link>
            <Link
              href={`/courses/${course.slug}#reviews`}
              className="rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Review this course
            </Link>
            <Link href="/my-courses" className="rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
              My courses
            </Link>
          </div>
        </section>
      )}

      <div className="mt-10 border-t border-gray-200 pt-6">
        {tracked && lesson.mode === "manual" && (
          <div className="mb-6 flex justify-center">
            <CompleteButton lessonId={lesson.id} completed={lesson.completed} />
          </div>
        )}
        {tracked && lesson.mode === "watch" && !lesson.completed && (
          <p className="mb-6 text-center text-xs text-gray-500">This lesson completes when you have watched the video.</p>
        )}
        {tracked && lesson.mode === "scorm" && !lesson.completed && (
          <p className="mb-6 text-center text-xs text-gray-500">This lesson completes when you finish the course above. Your place is saved as you go.</p>
        )}
        {tracked && lesson.mode === "scorm" && lesson.completed && <p className="mb-6 text-center text-sm font-bold text-green-700">Lesson completed</p>}
        {tracked && lesson.mode === "watch" && lesson.completed && (
          <p className="mb-6 text-center text-sm font-bold text-green-700">Lesson completed</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <NavLink lesson={previous} courseSlug={course.slug} direction="previous" />
          <NavLink lesson={next} courseSlug={course.slug} direction="next" />
        </div>
      </div>
    </LearnShell>
  );
}
