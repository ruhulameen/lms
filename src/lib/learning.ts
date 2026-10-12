import type { LessonTypeValue } from "@/lib/course";
import { progressPercent } from "@/lib/course";

// The rules of learning, as pure functions: when a lesson counts as done, where
// to resume, what a course's progress is. The services apply them to database
// rows and the player to what the learner does.

// A video completes by itself once this share of it has been watched.
export const VIDEO_COMPLETE_RATIO = 0.9;
// The player saves the position this often while a video plays.
export const POSITION_SAVE_INTERVAL_SECONDS = 15;

export type CompletionMode = "watch" | "manual" | "quiz";

// How a lesson becomes complete:
// - watch: a video with a file, automatically at VIDEO_COMPLETE_RATIO;
// - manual: text and documents, when the learner presses "Mark as complete"
//   (also a video that has no file yet, which there is nothing to watch for);
// - quiz: when the quiz is passed (stage 3).
export function completionMode(type: LessonTypeValue, hasFile: boolean): CompletionMode {
  if (type === "QUIZ") return "quiz";
  if (type === "VIDEO" && hasFile) return "watch";
  return "manual";
}

export function videoWatchedEnough(positionSeconds: number, durationSeconds: number | null | undefined) {
  if (!durationSeconds || durationSeconds <= 0 || !Number.isFinite(positionSeconds)) return false;
  return positionSeconds >= durationSeconds * VIDEO_COMPLETE_RATIO;
}

// A saved position as a whole number of seconds inside the video.
export function clampPosition(positionSeconds: number, durationSeconds?: number | null) {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return 0;
  const whole = Math.floor(positionSeconds);
  return durationSeconds && durationSeconds > 0 ? Math.min(whole, Math.floor(durationSeconds)) : whole;
}

// Where playback starts: the saved position, but from the beginning when the
// learner had barely started or had practically finished.
export function resumePosition(savedSeconds: number, durationSeconds?: number | null) {
  if (savedSeconds < 5) return 0;
  if (durationSeconds && durationSeconds > 0 && savedSeconds >= durationSeconds - 5) return 0;
  return savedSeconds;
}

export type OutlineLesson = { id: number };

// The lesson to open when a learner continues a course: the last lesson they
// were in if it is not finished, else the next unfinished one after it (looping
// to the start), else, when everything is done, the last lesson they were in or
// the first. Null for a course with no lessons.
export function pickResumeLesson<T extends OutlineLesson>(
  lessons: T[],
  completedIds: ReadonlySet<number>,
  lastLessonId: number | null | undefined,
): T | null {
  if (lessons.length === 0) return null;
  const lastIndex = lastLessonId == null ? -1 : lessons.findIndex((l) => l.id === lastLessonId);
  if (lastIndex >= 0 && !completedIds.has(lessons[lastIndex].id)) return lessons[lastIndex];
  const ordered = [...lessons.slice(lastIndex + 1), ...lessons.slice(0, lastIndex + 1)];
  const next = ordered.find((l) => !completedIds.has(l.id));
  if (next) return next;
  return lastIndex >= 0 ? lessons[lastIndex] : lessons[0];
}

export function adjacentLessons<T extends OutlineLesson>(lessons: T[], lessonId: number) {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return { previous: null, next: null };
  return { previous: lessons[index - 1] ?? null, next: lessons[index + 1] ?? null };
}

export type EnrolmentStatusValue = "ACTIVE" | "COMPLETED" | "CANCELLED";

// Course progress after a lesson change. A course with no published lessons
// never completes. Once COMPLETED an enrolment stays so (a lesson added later
// lowers the percent but does not take a finished course away); `justCompleted`
// is true only on the change that finishes it, which is when a certificate is due.
export function enrolmentOutcome(completedLessons: number, totalLessons: number, status: EnrolmentStatusValue) {
  const percent = progressPercent(completedLessons, totalLessons);
  const finished = totalLessons > 0 && completedLessons >= totalLessons;
  const justCompleted = finished && status === "ACTIVE";
  return {
    percent,
    status: justCompleted ? ("COMPLETED" as const) : status,
    justCompleted,
  };
}

// An enrolment that unlocks lessons.
export const hasLearnerAccess = (status: EnrolmentStatusValue) => status === "ACTIVE" || status === "COMPLETED";
