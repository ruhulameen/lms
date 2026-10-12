import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parseOptions, type QuestionTypeValue, type QuizOption } from "@/lib/quiz";

// Quiz data for the builder. Correct answers are in these results: only call
// them after checking the viewer manages the course. Learners get their
// version from src/services/quiz-attempt.ts.

export type QuizSettings = {
  passingScore: number;
  attemptLimit: number | null;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  passFeedback: string | null;
  failFeedback: string | null;
};

export type QuizQuestionView = {
  id: number;
  type: QuestionTypeValue;
  text: string;
  explanation: string | null;
  points: number;
  options: QuizOption[];
};

// Every quiz lesson has a Quiz row (created with the lesson); this makes one
// for a lesson that somehow lacks it. Two requests may race to create it.
export async function ensureQuiz(lessonId: number) {
  const existing = await db.quiz.findUnique({ where: { lessonId }, select: { id: true } });
  if (existing) return existing.id;
  try {
    return (await db.quiz.create({ data: { lessonId }, select: { id: true } })).id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    return (await db.quiz.findUniqueOrThrow({ where: { lessonId }, select: { id: true } })).id;
  }
}

export async function getQuizForEdit(courseId: number, lessonId: number) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, courseId, type: "QUIZ" }, select: { id: true } });
  if (!lesson) return null;
  const quizId = await ensureQuiz(lessonId);
  const quiz = await db.quiz.findUniqueOrThrow({
    where: { id: quizId },
    select: {
      id: true,
      passingScore: true,
      attemptLimit: true,
      timeLimitMinutes: true,
      shuffleQuestions: true,
      passFeedback: true,
      failFeedback: true,
      questions: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      _count: { select: { attempts: true } },
    },
  });
  return {
    id: quiz.id,
    settings: {
      passingScore: quiz.passingScore,
      attemptLimit: quiz.attemptLimit,
      timeLimitMinutes: quiz.timeLimitMinutes,
      shuffleQuestions: quiz.shuffleQuestions,
      passFeedback: quiz.passFeedback,
      failFeedback: quiz.failFeedback,
    } satisfies QuizSettings,
    questions: quiz.questions.map(
      (q): QuizQuestionView => ({ id: q.id, type: q.type, text: q.text, explanation: q.explanation, points: q.points, options: parseOptions(q.options) }),
    ),
    attemptCount: quiz._count.attempts,
  };
}

// For staff previewing a quiz lesson in the player (the page has already
// checked they manage the course): settings and questions with the answers.
export async function getQuizPreview(lessonId: number) {
  const quiz = await db.quiz.findUnique({
    where: { lessonId },
    select: {
      passingScore: true,
      attemptLimit: true,
      timeLimitMinutes: true,
      questions: { orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  });
  if (!quiz) return null;
  return {
    passingScore: quiz.passingScore,
    attemptLimit: quiz.attemptLimit,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questions: quiz.questions.map(
      (q): QuizQuestionView => ({ id: q.id, type: q.type, text: q.text, explanation: q.explanation, points: q.points, options: parseOptions(q.options) }),
    ),
  };
}

// Counts for the intro shown to people who cannot take the quiz (free preview).
export async function getQuizSummary(lessonId: number) {
  const quiz = await db.quiz.findUnique({
    where: { lessonId },
    select: { passingScore: true, attemptLimit: true, timeLimitMinutes: true, _count: { select: { questions: true } } },
  });
  return quiz
    ? { passingScore: quiz.passingScore, attemptLimit: quiz.attemptLimit, timeLimitMinutes: quiz.timeLimitMinutes, questionCount: quiz._count.questions }
    : null;
}
