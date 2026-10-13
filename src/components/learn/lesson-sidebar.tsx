import Link from "next/link";
import { Check, FileText, HelpCircle, Lock, Package, PlayCircle, Type, type LucideIcon } from "lucide-react";
import { formatLessonDuration, lessonTypeLabels, type LessonTypeValue } from "@/lib/course";
import { cn } from "@/lib/utils";
import type { PlayerModule } from "@/services/learning";

const typeIcons: Record<LessonTypeValue, LucideIcon> = {
  VIDEO: PlayCircle,
  TEXT: Type,
  DOCUMENT: FileText,
  QUIZ: HelpCircle,
  SCORM: Package,
};

// Modules and lessons of the course: ticks for finished lessons, the open one
// highlighted, a lock on lessons this viewer cannot open.
export function LessonSidebar({
  courseSlug,
  currentId,
  modules,
}: {
  courseSlug: string;
  currentId: number;
  modules: PlayerModule[];
}) {
  return (
    <nav aria-label="Lessons" className="pb-6">
      {modules.map((module, index) => (
        <section key={module.id}>
          <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            Module {index + 1} · {module.title}
          </h2>
          <ul>
            {module.lessons.map((lesson) => {
              const Icon = typeIcons[lesson.type];
              const current = lesson.id === currentId;
              const length = formatLessonDuration(lesson.durationSeconds);
              const body = (
                <>
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      lesson.completed ? "bg-green-500 text-white" : "text-blue-600",
                    )}
                  >
                    {lesson.completed ? (
                      <Check className="size-3.5" aria-hidden />
                    ) : lesson.accessible ? (
                      <Icon className="size-4" aria-hidden />
                    ) : (
                      <Lock className="size-3.5 text-gray-400" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">{lesson.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {lessonTypeLabels[lesson.type]}
                      {length && ` · ${length}`}
                      {!lesson.published && " · Draft"}
                      {lesson.completed && <span className="sr-only"> (completed)</span>}
                      {!lesson.accessible && <span className="sr-only"> (locked)</span>}
                    </span>
                  </span>
                  {lesson.isFreePreview && !lesson.completed && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">Preview</span>
                  )}
                </>
              );
              const base = "flex items-start gap-3 border-l-4 px-4 py-3";
              return (
                <li key={lesson.id}>
                  {lesson.accessible ? (
                    <Link
                      href={`/learn/${courseSlug}/${lesson.slug}`}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        base,
                        "outline-none transition focus-visible:bg-blue-50",
                        current
                          ? "border-blue-600 bg-blue-50 font-semibold text-navy"
                          : "border-transparent text-gray-700 hover:bg-gray-50",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={cn(base, "border-transparent text-gray-400")}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
