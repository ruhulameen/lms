import "server-only";
import { db } from "@/lib/db";
import {
  emptyScormProgress,
  resolveScormStatus,
  sanitiseScormProgress,
  scormStatusCompletes,
  scormStatuses,
  type ScormProgress,
  type ScormStatus,
} from "@/lib/scorm";
import { completeLessonForEnrolment, learnerLesson } from "@/services/learning";

// SCORM lessons while they are being taken. A package is a zip holding a small
// website; src/services/scorm-package.ts unpacks it into the private bucket,
// /scorm/<lessonId>/... serves it to learners (same access rule as any lesson
// file), and what it reports while it runs is kept per learner in `scorm_state`.

// ---------------------------------------------------------------- a learner's progress

const toProgress = (row: {
  lessonStatus: string;
  lessonLocation: string | null;
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  suspendData: string | null;
  totalTimeSeconds: number;
}): ScormProgress => ({
  lessonStatus: scormStatuses.find((s) => s === row.lessonStatus) ?? "not attempted",
  lessonLocation: row.lessonLocation ?? "",
  scoreRaw: row.scoreRaw,
  scoreMin: row.scoreMin,
  scoreMax: row.scoreMax,
  suspendData: row.suspendData ?? "",
  totalTimeSeconds: row.totalTimeSeconds,
});

// Where the learner left the package, to hand back when it starts.
export async function getScormProgress(enrolmentId: number, lessonId: number): Promise<ScormProgress> {
  const row = await db.scormState.findUnique({ where: { enrolmentId_lessonId: { enrolmentId, lessonId } } });
  return row ? toProgress(row) : emptyScormProgress;
}

export type SaveScormResult =
  | { ok: true; lessonStatus: ScormStatus; lessonCompleted: boolean; progressPercent: number | null; courseCompleted: boolean }
  | { ok: false; error: string };

// Stores what the package reported and ticks the lesson off when it says the
// learner finished or passed. `raw` comes from the browser and is not trusted
// beyond its shape: a learner who edits it can only mark their own lesson done,
// as with the "Mark as complete" button on a text lesson.
export async function saveScormProgress(userId: number, lessonId: number, raw: unknown): Promise<SaveScormResult> {
  const progress = sanitiseScormProgress(raw);
  if (!progress) return { ok: false, error: "Invalid progress." };
  const found = await learnerLesson(userId, lessonId);
  if (!found || found.lesson.type !== "SCORM") return { ok: false, error: "Progress is not saved for this lesson." };

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { scormMastery: true } });
  const key = { enrolmentId_lessonId: { enrolmentId: found.enrolmentId, lessonId } };
  const before = await db.scormState.findUnique({ where: key, select: { lessonStatus: true } });

  let status = resolveScormStatus(progress.lessonStatus, progress.scoreRaw, lesson?.scormMastery ?? null);
  // Once finished or passed it stays so: opening the package again to review
  // it (which reports "incomplete" or "browsed") does not undo the result.
  const was = scormStatuses.find((s) => s === before?.lessonStatus);
  if (was && scormStatusCompletes(was) && !scormStatusCompletes(status)) status = was;

  const { sessionSeconds, totalTimeSeconds: _ignored, ...fields } = progress;
  void _ignored;
  const data = { ...fields, lessonStatus: status, lessonLocation: fields.lessonLocation || null, suspendData: fields.suspendData || null };
  await db.scormState.upsert({
    where: key,
    create: { enrolmentId: found.enrolmentId, lessonId, ...data, totalTimeSeconds: sessionSeconds },
    update: { ...data, totalTimeSeconds: { increment: sessionSeconds } },
  });

  if (!scormStatusCompletes(status)) return { ok: true, lessonStatus: status, lessonCompleted: false, progressPercent: null, courseCompleted: false };
  const update = await completeLessonForEnrolment(found.enrolmentId, lessonId);
  return { ok: true, lessonStatus: status, lessonCompleted: true, progressPercent: update?.progressPercent ?? null, courseCompleted: update?.justCompleted ?? false };
}

// ---------------------------------------------------------------- starting a package

export type ScormLaunch = {
  // Address of the package's start page on this site.
  src: string;
  masteryScore: number | null;
  launchData: string;
};

// What the player needs to start a lesson's package, or null when none is attached.
export async function getScormLaunch(lessonId: number): Promise<ScormLaunch | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { type: true, scormPrefix: true, scormEntry: true, scormMastery: true, scormLaunchData: true },
  });
  if (!lesson || lesson.type !== "SCORM" || !lesson.scormPrefix || !lesson.scormEntry) return null;
  return {
    src: `/scorm/${lessonId}/${lesson.scormEntry.split("/").map(encodeURIComponent).join("/")}`,
    masteryScore: lesson.scormMastery,
    launchData: lesson.scormLaunchData ?? "",
  };
}
