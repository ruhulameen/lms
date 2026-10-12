import { z } from "zod";
import { questionTypes } from "@/lib/course";

// Quiz rules as pure functions: field validation, scoring, the pass rule, the
// attempt and time limits. The services apply them to database rows; the quiz
// builder and the quiz taker share the limits and types.

export type QuestionTypeValue = (typeof questionTypes)[number];

export const questionTypeLabels: Record<QuestionTypeValue, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple select",
  TRUE_FALSE: "True / false",
};

export type QuizOption = { id: string; text: string; correct: boolean };

export const QUESTION_TEXT_MAX = 1000;
export const QUESTION_EXPLANATION_MAX = 1000;
export const OPTION_TEXT_MAX = 300;
export const QUESTION_POINTS_MAX = 100;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;
export const FEEDBACK_MAX = 1000;
export const ATTEMPT_LIMIT_MAX = 50;
export const TIME_LIMIT_MAX_MINUTES = 600;
// A submission may arrive this long after the time limit (network, slow
// browser); later than that the attempt has timed out.
export const QUIZ_GRACE_SECONDS = 30;

export const TRUE_FALSE_OPTIONS = [
  { id: "true", text: "True" },
  { id: "false", text: "False" },
] as const;

// ---------------------------------------------------------------- validation

const optionIdPattern = /^[A-Za-z0-9_-]{1,20}$/;

const optionSchema = z.object({
  id: z.string().regex(optionIdPattern),
  text: z.string().trim().max(OPTION_TEXT_MAX, `Use at most ${OPTION_TEXT_MAX} characters for an answer.`),
  correct: z.boolean(),
});

// Why these options cannot be saved for this type, or null when they can.
export function optionsError(type: QuestionTypeValue, options: readonly Pick<QuizOption, "id" | "text" | "correct">[]): string | null {
  if (type === "TRUE_FALSE") {
    if (options.length !== 2) return "A true / false question has two answers.";
    return options.filter((o) => o.correct).length === 1 ? null : "Choose whether the statement is true or false.";
  }
  if (options.length < MIN_OPTIONS) return `Add at least ${MIN_OPTIONS} answers.`;
  if (options.length > MAX_OPTIONS) return `Use at most ${MAX_OPTIONS} answers.`;
  if (options.some((o) => !o.text.trim())) return "Fill in every answer or remove the empty ones.";
  if (new Set(options.map((o) => o.id)).size !== options.length) return "Every answer needs its own id.";
  if (new Set(options.map((o) => o.text.trim().toLowerCase())).size !== options.length) return "Two answers are the same.";
  const correct = options.filter((o) => o.correct).length;
  if (type === "SINGLE_CHOICE" && correct !== 1) return "Mark exactly one answer as correct.";
  if (type === "MULTIPLE_CHOICE" && correct < 1) return "Mark at least one answer as correct.";
  return null;
}

// True / false questions always hold the same two options; only which is right varies.
export function canonicalOptions(type: QuestionTypeValue, options: readonly QuizOption[]): QuizOption[] {
  if (type === "TRUE_FALSE") {
    return TRUE_FALSE_OPTIONS.map((fixed, index) => ({ ...fixed, correct: Boolean(options[index]?.correct) }));
  }
  return options.map((o) => ({ id: o.id, text: o.text.trim(), correct: o.correct }));
}

export const questionInputSchema = z
  .object({
    type: z.enum(questionTypes, { error: "Choose a question type." }),
    text: z.string().trim().min(1, "Enter the question.").max(QUESTION_TEXT_MAX, `Use at most ${QUESTION_TEXT_MAX} characters.`),
    explanation: z
      .string()
      .trim()
      .max(QUESTION_EXPLANATION_MAX, `Use at most ${QUESTION_EXPLANATION_MAX} characters.`)
      .optional()
      .transform((v) => v || null),
    points: z.number().int("Points must be a whole number.").min(1, "Give the question at least 1 point.").max(QUESTION_POINTS_MAX, `Use at most ${QUESTION_POINTS_MAX} points.`),
    options: z.array(optionSchema).max(MAX_OPTIONS),
  })
  .superRefine((value, ctx) => {
    const message = optionsError(value.type, value.options);
    if (message) ctx.addIssue({ code: "custom", path: ["options"], message });
  });

export type QuestionInput = z.input<typeof questionInputSchema>;

const optionalWhole = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx): number | null => {
      if (!v) return null;
      const n = Number(v);
      if (!/^\d{1,4}$/.test(v) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from ${min} to ${max}.` });
        return z.NEVER;
      }
      return n;
    });

const feedbackField = z
  .string()
  .trim()
  .max(FEEDBACK_MAX, `Use at most ${FEEDBACK_MAX} characters.`)
  .optional()
  .transform((v) => v || null);

// The quiz settings form: empty attempt limit / time limit means none.
export const quizSettingsSchema = z.object({
  passingScore: optionalWhole("Passing score", 1, 100).refine((v): v is number => v !== null, "Enter the passing score, from 1 to 100."),
  attemptLimit: optionalWhole("Attempt limit", 1, ATTEMPT_LIMIT_MAX),
  timeLimitMinutes: optionalWhole("Time limit", 1, TIME_LIMIT_MAX_MINUTES),
  shuffleQuestions: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  passFeedback: feedbackField,
  failFeedback: feedbackField,
});

// The options column is Json; read it defensively.
const storedOptionsSchema = z.array(z.object({ id: z.string(), text: z.string(), correct: z.boolean() }));
export function parseOptions(json: unknown): QuizOption[] {
  const parsed = storedOptionsSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
}

// ---------------------------------------------------------------- scoring

export type ScorableQuestion = { id: number; points: number; options: readonly QuizOption[] };
export type Answers = Record<string, string[]>;

export type QuestionResult = {
  questionId: number;
  selected: string[];
  correct: boolean;
  earned: number;
  points: number;
};

// The chosen ids that really are options of the question, without repeats, in option order.
export function validSelection(options: readonly QuizOption[], selected: readonly string[] | undefined) {
  const chosen = new Set(selected ?? []);
  return options.filter((o) => chosen.has(o.id)).map((o) => o.id);
}

// All or nothing: a question is right when the chosen answers are exactly the
// correct ones (a multiple select with one answer missing earns nothing).
export function scoreQuestion(question: ScorableQuestion, selected: readonly string[] | undefined): QuestionResult {
  const picked = validSelection(question.options, selected);
  const right = question.options.filter((o) => o.correct).map((o) => o.id);
  const correct = right.length > 0 && picked.length === right.length && picked.every((id) => right.includes(id));
  return { questionId: question.id, selected: picked, correct, earned: correct ? question.points : 0, points: question.points };
}

// Percent with one decimal; 0 when the quiz is worth nothing.
export function percentOf(score: number, maxScore: number) {
  return maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0;
}

// Passed when the score reaches the passing percent. Compared on whole
// numbers so 69.99... can never round up into a pass. A quiz worth 0 never passes.
export function isPassing(score: number, maxScore: number, passingScore: number) {
  return maxScore > 0 && score * 100 >= passingScore * maxScore;
}

export function scoreAttempt(questions: readonly ScorableQuestion[], answers: Answers, passingScore: number) {
  const results = questions.map((q) => scoreQuestion(q, answers[String(q.id)]));
  const score = results.reduce((sum, r) => sum + r.earned, 0);
  const maxScore = results.reduce((sum, r) => sum + r.points, 0);
  return { results, score, maxScore, percent: percentOf(score, maxScore), passed: isPassing(score, maxScore, passingScore) };
}

// ---------------------------------------------------------------- attempt snapshot

export type SnapshotQuestion = {
  id: number;
  type: QuestionTypeValue;
  text: string;
  explanation: string | null;
  points: number;
  options: QuizOption[];
  selected: string[];
  correct: boolean;
  earned: number;
};

// What QuizAttempt.answers holds: the questions as they were when the attempt
// was scored, with the learner's choices, so the review stays readable after
// the quiz is edited.
export type AttemptSnapshot = { version: 1; timedOut: boolean; questions: SnapshotQuestion[] };

export type QuestionRecord = ScorableQuestion & { type: QuestionTypeValue; text: string; explanation: string | null };

export function buildSnapshot(
  questions: readonly QuestionRecord[],
  results: readonly QuestionResult[],
  timedOut: boolean,
): AttemptSnapshot {
  return {
    version: 1,
    timedOut,
    questions: questions.map((q, index) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      explanation: q.explanation,
      points: q.points,
      options: q.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })),
      selected: results[index].selected,
      correct: results[index].correct,
      earned: results[index].earned,
    })),
  };
}

const snapshotSchema = z.object({
  version: z.literal(1),
  timedOut: z.boolean(),
  questions: z.array(
    z.object({
      id: z.number(),
      type: z.enum(questionTypes),
      text: z.string(),
      explanation: z.string().nullable(),
      points: z.number(),
      options: storedOptionsSchema,
      selected: z.array(z.string()),
      correct: z.boolean(),
      earned: z.number(),
    }),
  ),
});

export function parseSnapshot(json: unknown): AttemptSnapshot | null {
  const parsed = snapshotSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// What the learner sees while taking the quiz: no `correct` flags.
export type PublicQuestion = {
  id: number;
  type: QuestionTypeValue;
  text: string;
  points: number;
  options: { id: string; text: string }[];
};

export function toPublicQuestion(q: QuestionRecord): PublicQuestion {
  return { id: q.id, type: q.type, text: q.text, points: q.points, options: q.options.map((o) => ({ id: o.id, text: o.text })) };
}

// ---------------------------------------------------------------- limits

export function attemptsLeft(attemptLimit: number | null, used: number): number | null {
  return attemptLimit === null ? null : Math.max(attemptLimit - used, 0);
}

export function canStartAttempt(attemptLimit: number | null, used: number) {
  return attemptLimit === null || used < attemptLimit;
}

export function attemptDeadline(startedAt: Date, timeLimitMinutes: number | null): Date | null {
  return timeLimitMinutes === null ? null : new Date(startedAt.getTime() + timeLimitMinutes * 60_000);
}

export type AttemptTime = "open" | "grace" | "expired";

// open: within the limit (or no limit); grace: just past it, still accepted;
// expired: too late, the attempt has timed out.
export function attemptTime(startedAt: Date, timeLimitMinutes: number | null, now: Date): AttemptTime {
  const deadline = attemptDeadline(startedAt, timeLimitMinutes);
  if (!deadline || now.getTime() <= deadline.getTime()) return "open";
  return now.getTime() <= deadline.getTime() + QUIZ_GRACE_SECONDS * 1000 ? "grace" : "expired";
}

// Whole seconds left before the deadline (0 when past it), or null with no limit.
export function secondsLeft(startedAt: Date, timeLimitMinutes: number | null, now: Date): number | null {
  const deadline = attemptDeadline(startedAt, timeLimitMinutes);
  return deadline ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000)) : null;
}

// "9:05", "1:02:09".
export function formatCountdown(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

export function bestPercent(attempts: readonly { percent: number | null }[]) {
  const values = attempts.map((a) => a.percent).filter((p): p is number => p !== null);
  return values.length ? Math.max(...values) : null;
}

// ---------------------------------------------------------------- ordering

// Deterministic shuffle (Fisher-Yates over a small seeded generator), so a
// resumed attempt shows the same order as the one that was started.
export function shuffleSeeded<T>(items: readonly T[], seed: number): T[] {
  let state = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Moves one id a step up (-1) or down (1); unchanged at the ends or for an unknown id.
export function moveId<T>(ids: readonly T[], id: T, direction: -1 | 1): T[] {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const result = [...ids];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
