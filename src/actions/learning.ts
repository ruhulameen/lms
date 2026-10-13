"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getLessonFileUrl, getLessonResourceUrl, type FileLink } from "@/services/lesson-access";
import { markLessonCompleteByLearner, saveVideoPosition } from "@/services/learning";
import { saveScormProgress } from "@/services/scorm";
import { getCurrentUser } from "@/services/user";

const SIGNED_OUT = "Your session has expired. Sign in again.";
const id = z.number().int().positive();

export type ProgressData = { progressPercent: number; courseCompleted: boolean };

// "Mark as complete" on text and document lessons.
export async function markLessonComplete(lessonId: number): Promise<ActionResult<ProgressData>> {
  const parsed = id.safeParse(lessonId);
  if (!parsed.success) return { ok: false, error: "Invalid lesson." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const result = await markLessonCompleteByLearner(user.id, parsed.data);
  if (!result.ok) return result;
  return { ok: true, data: { progressPercent: result.progressPercent, courseCompleted: result.status === "COMPLETED" } };
}

const positionSchema = z.object({
  lessonId: id,
  positionSeconds: z.number().min(0).max(24 * 60 * 60),
  durationSeconds: z.number().positive().max(24 * 60 * 60).nullable(),
});

export type PositionData = ProgressData & { lessonCompleted: boolean };

// Called by the video player every few seconds, on pause and when leaving.
// Completes the lesson once enough of the video has been watched.
export async function saveLessonPosition(
  input: z.input<typeof positionSchema>,
): Promise<ActionResult<PositionData>> {
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid progress." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const { lessonId, positionSeconds, durationSeconds } = parsed.data;
  const result = await saveVideoPosition(user.id, lessonId, positionSeconds, durationSeconds);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      progressPercent: result.progressPercent,
      courseCompleted: result.justCompleted,
      lessonCompleted: result.completed,
    },
  };
}

const NO_FILE = "There is no file for this lesson yet.";

function linkResult(link: FileLink): ActionResult<{ url: string }> {
  if (link.ok) return { ok: true, data: { url: link.url } };
  const error =
    link.reason === "no-file" || link.reason === "not-configured"
      ? NO_FILE
      : link.reason === "forbidden"
        ? "You do not have access to this lesson."
        : "This lesson no longer exists.";
  return { ok: false, error };
}

// A fresh playback link for a lesson video, for when the one the page was
// rendered with has expired.
export async function refreshVideoLink(lessonId: number): Promise<ActionResult<{ url: string }>> {
  const parsed = id.safeParse(lessonId);
  if (!parsed.success) return { ok: false, error: "Invalid lesson." };
  const user = await getCurrentUser();
  return linkResult(await getLessonFileUrl(user, parsed.data, { mode: "play" }));
}

const downloadSchema = z.object({ kind: z.enum(["lesson", "resource"]), id });

// A fresh download link, made when the learner presses Download so it never
// goes stale on the page. Same access rules as the lesson itself.
export async function getDownloadLink(input: z.input<typeof downloadSchema>): Promise<ActionResult<{ url: string }>> {
  const parsed = downloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid download." };
  const user = await getCurrentUser();
  const link =
    parsed.data.kind === "lesson"
      ? await getLessonFileUrl(user, parsed.data.id, { mode: "download" })
      : await getLessonResourceUrl(user, parsed.data.id);
  return linkResult(link);
}

const scormSchema = z.object({ lessonId: id, progress: z.unknown() });

export type ScormSaveData = { lessonCompleted: boolean; courseCompleted: boolean };

// Called by the SCORM player whenever the package saves, and when it finishes.
export async function saveScormLessonProgress(input: z.input<typeof scormSchema>): Promise<ActionResult<ScormSaveData>> {
  const parsed = scormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid progress." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const result = await saveScormProgress(user.id, parsed.data.lessonId, parsed.data.progress);
  if (!result.ok) return result;
  return { ok: true, data: { lessonCompleted: result.lessonCompleted, courseCompleted: result.courseCompleted } };
}
