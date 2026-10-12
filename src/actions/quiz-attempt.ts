"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { checkRateLimit } from "@/lib/rate-limit";
import { startAttempt, submitAttempt, type OpenAttemptView, type SubmitView } from "@/services/quiz-attempt";
import { getCurrentUser } from "@/services/user";

const SIGNED_OUT = "Your session has expired. Sign in again.";
const HOUR = 60 * 60;

// Begin (or resume) an attempt at the quiz lesson. The questions come back
// without their correct answers.
export async function startQuizAttempt(lessonId: number): Promise<ActionResult<{ attempt: OpenAttemptView }>> {
  const parsed = z.number().int().positive().safeParse(lessonId);
  if (!parsed.success) return { ok: false, error: "Invalid lesson." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const limited = await checkRateLimit("quiz-start", [{ scope: "user", value: user.id, limit: 60, windowSeconds: HOUR }]);
  if (limited) return { ok: false, error: limited };

  const result = await startAttempt(user.id, parsed.data);
  return result.ok ? { ok: true, data: { attempt: result.attempt } } : result;
}

const submitSchema = z.object({
  attemptId: z.number().int().positive(),
  // { [questionId]: chosen option ids }
  answers: z.record(z.string().regex(/^\d{1,10}$/), z.array(z.string().max(20)).max(8)),
});

// Score an attempt. The result includes the review with correct answers,
// which is only sent once the attempt is closed.
export async function submitQuizAttempt(input: z.input<typeof submitSchema>): Promise<ActionResult<{ result: SubmitView }>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid answers." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const limited = await checkRateLimit("quiz-submit", [{ scope: "user", value: user.id, limit: 60, windowSeconds: HOUR }]);
  if (limited) return { ok: false, error: limited };

  const result = await submitAttempt(user.id, parsed.data.attemptId, parsed.data.answers);
  return result.ok ? { ok: true, data: { result: result.result } } : result;
}
