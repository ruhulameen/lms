import "server-only";
import { db } from "@/lib/db";
import {
  attemptTime,
  attemptsLeft,
  bestPercent,
  buildSnapshot,
  canStartAttempt,
  parseOptions,
  parseSnapshot,
  scoreAttempt,
  secondsLeft,
  shuffleSeeded,
  toPublicQuestion,
  type Answers,
  type PublicQuestion,
  type QuestionRecord,
  type SnapshotQuestion,
} from "@/lib/quiz";
import { logActivity } from "@/services/activity";
import { completeLessonForEnrolment, learnerLesson } from "@/services/learning";

// Taking a quiz. Everything that decides a result happens here, on the server:
// the questions are read from the database, the answers scored against them,
// the attempt and time limits checked. The browser never receives a correct
// answer until its attempt has been submitted.

type QuizRow = NonNullable<Awaited<ReturnType<typeof loadQuiz>>>;
type AttemptRow = Awaited<ReturnType<typeof loadAttempts>>[number];

async function loadQuiz(lessonId: number) {
  return db.quiz.findUnique({
    where: { lessonId },
    select: {
      id: true,
      passingScore: true,
      attemptLimit: true,
      timeLimitMinutes: true,
      shuffleQuestions: true,
      passFeedback: true,
      failFeedback: true,
      lesson: { select: { id: true, title: true, published: true, course: { select: { title: true } } } },
      questions: { orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  });
}

async function loadAttempts(quizId: number, enrolmentId: number) {
  return db.quizAttempt.findMany({
    where: { quizId, enrolmentId },
    orderBy: { id: "asc" },
    select: { id: true, userId: true, startedAt: true, submittedAt: true, score: true, maxScore: true, percent: true, passed: true, answers: true },
  });
}

const records = (quiz: QuizRow): QuestionRecord[] =>
  quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    explanation: q.explanation,
    points: q.points,
    options: parseOptions(q.options),
  }));

export type AttemptSummary = {
  id: number;
  submittedAt: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  timedOut: boolean;
};

export type AttemptReviewView = AttemptSummary & {
  feedback: string | null;
  questions: SnapshotQuestion[];
};

export type OpenAttemptView = {
  id: number;
  // Counted down by the browser from here; the server decides when it is over.
  secondsLeft: number | null;
  questions: PublicQuestion[];
};

// Scores the answers against the stored questions and closes the attempt.
// Returns false when another request closed it first.
async function closeAttempt(quiz: QuizRow, attemptId: number, answers: Answers, timedOut: boolean) {
  const questions = records(quiz);
  const scored = scoreAttempt(questions, timedOut ? {} : answers, quiz.passingScore);
  const closed = await db.quizAttempt.updateMany({
    where: { id: attemptId, submittedAt: null },
    data: {
      submittedAt: new Date(),
      score: scored.score,
      maxScore: scored.maxScore,
      percent: scored.percent,
      passed: scored.passed,
      answers: buildSnapshot(questions, scored.results, timedOut),
    },
  });
  return closed.count === 1 ? scored : null;
}

// Attempts that ran out of time without being submitted (the learner left the
// page) are closed as timed out; they count as used. Older open attempts left
// by two simultaneous starts are closed too. Returns the attempts afterwards.
async function settleAttempts(quiz: QuizRow, enrolmentId: number, now: Date) {
  let attempts = await loadAttempts(quiz.id, enrolmentId);
  const open = attempts.filter((a) => a.submittedAt === null);
  const stale = open.filter((a, index) => index < open.length - 1 || attemptTime(a.startedAt, quiz.timeLimitMinutes, now) === "expired");
  if (stale.length === 0) return attempts;
  for (const attempt of stale) await closeAttempt(quiz, attempt.id, {}, true);
  attempts = await loadAttempts(quiz.id, enrolmentId);
  return attempts;
}

const feedbackFor = (quiz: QuizRow, passed: boolean) => (passed ? quiz.passFeedback : quiz.failFeedback);

function summarise(attempt: AttemptRow): AttemptSummary | null {
  if (!attempt.submittedAt || attempt.score === null || attempt.maxScore === null || attempt.percent === null) return null;
  const snapshot = parseSnapshot(attempt.answers);
  return {
    id: attempt.id,
    submittedAt: attempt.submittedAt.toISOString(),
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    passed: Boolean(attempt.passed),
    timedOut: snapshot?.timedOut ?? false,
  };
}

function reviewOf(quiz: QuizRow, attempt: AttemptRow): AttemptReviewView | null {
  const summary = summarise(attempt);
  const snapshot = parseSnapshot(attempt.answers);
  if (!summary || !snapshot) return null;
  return { ...summary, feedback: feedbackFor(quiz, summary.passed), questions: snapshot.questions };
}

function openView(quiz: QuizRow, attempt: AttemptRow, now: Date): OpenAttemptView {
  const ordered = records(quiz);
  const shown = quiz.shuffleQuestions ? shuffleSeeded(ordered, attempt.id) : ordered;
  return {
    id: attempt.id,
    secondsLeft: secondsLeft(attempt.startedAt, quiz.timeLimitMinutes, now),
    questions: shown.map(toPublicQuestion),
  };
}

export type LearnerQuizState =
  | { status: "empty" }
  | {
      status: "ready";
      questionCount: number;
      totalPoints: number;
      passingScore: number;
      timeLimitMinutes: number | null;
      attemptLimit: number | null;
      attemptsUsed: number;
      attemptsLeft: number | null;
      bestPercent: number | null;
      // Passed at least once, whatever the later attempts.
      passed: boolean;
      open: OpenAttemptView | null;
      history: AttemptSummary[];
      // Review of the most recent submitted attempt.
      latest: AttemptReviewView | null;
    };

// What the quiz page shows a learner. No correct answers: `open` carries
// questions without them, `latest` is an attempt already submitted.
export async function getLearnerQuizState(enrolmentId: number, lessonId: number): Promise<LearnerQuizState> {
  const quiz = await loadQuiz(lessonId);
  if (!quiz || quiz.questions.length === 0) return { status: "empty" };
  const now = new Date();
  const attempts = await settleAttempts(quiz, enrolmentId, now);
  const submitted = attempts.filter((a) => a.submittedAt !== null);
  const openAttempt = attempts.find((a) => a.submittedAt === null) ?? null;
  const history = submitted.map(summarise).filter((s): s is AttemptSummary => s !== null);
  const lastSubmitted = submitted.at(-1);

  return {
    status: "ready",
    questionCount: quiz.questions.length,
    totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
    passingScore: quiz.passingScore,
    timeLimitMinutes: quiz.timeLimitMinutes,
    attemptLimit: quiz.attemptLimit,
    attemptsUsed: attempts.length,
    attemptsLeft: attemptsLeft(quiz.attemptLimit, attempts.length),
    bestPercent: bestPercent(submitted),
    passed: submitted.some((a) => a.passed),
    open: openAttempt ? openView(quiz, openAttempt, now) : null,
    history,
    latest: lastSubmitted ? reviewOf(quiz, lastSubmitted) : null,
  };
}

export type StartResult = { ok: true; attempt: OpenAttemptView } | { ok: false; error: string };

// Starts an attempt, or hands back the one in progress.
export async function startAttempt(userId: number, lessonId: number): Promise<StartResult> {
  const found = await learnerLesson(userId, lessonId);
  if (!found || found.lesson.type !== "QUIZ") return { ok: false, error: "You are not enrolled in this course." };
  const quiz = await loadQuiz(lessonId);
  if (!quiz || quiz.questions.length === 0) return { ok: false, error: "This quiz has no questions yet." };

  const now = new Date();
  const attempts = await settleAttempts(quiz, found.enrolmentId, now);
  const open = attempts.find((a) => a.submittedAt === null);
  if (open) return { ok: true, attempt: openView(quiz, open, now) };
  if (!canStartAttempt(quiz.attemptLimit, attempts.length)) {
    return { ok: false, error: "You have used all your attempts for this quiz." };
  }

  const created = await db.quizAttempt.create({
    data: { quizId: quiz.id, enrolmentId: found.enrolmentId, userId, startedAt: now },
    select: { id: true, userId: true, startedAt: true, submittedAt: true, score: true, maxScore: true, percent: true, passed: true, answers: true },
  });
  return { ok: true, attempt: openView(quiz, created, now) };
}

export type SubmitView = AttemptReviewView & {
  attemptsLeft: number | null;
  // The lesson is complete after this attempt (this or an earlier pass).
  lessonCompleted: boolean;
  // This attempt finished the whole course.
  courseCompleted: boolean;
};

export type SubmitResult = { ok: true; result: SubmitView } | { ok: false; error: string };

// Scores a submission. Past the time limit plus a short grace period the
// answers are ignored and the attempt is recorded as timed out (zero).
// Submitting an attempt twice returns the first result.
export async function submitAttempt(userId: number, attemptId: number, answers: Answers): Promise<SubmitResult> {
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId }, select: { id: true, userId: true, enrolmentId: true, quiz: { select: { lessonId: true } } } });
  if (!attempt || attempt.userId !== userId) return { ok: false, error: "This attempt no longer exists." };
  const found = await learnerLesson(userId, attempt.quiz.lessonId);
  if (!found || found.enrolmentId !== attempt.enrolmentId) return { ok: false, error: "You are not enrolled in this course." };

  const quiz = await loadQuiz(attempt.quiz.lessonId);
  if (!quiz) return { ok: false, error: "This quiz no longer exists." };
  const row = (await loadAttempts(quiz.id, attempt.enrolmentId)).find((a) => a.id === attemptId);
  if (!row) return { ok: false, error: "This attempt no longer exists." };

  let courseCompleted = false;
  if (row.submittedAt === null) {
    const timedOut = attemptTime(row.startedAt, quiz.timeLimitMinutes, new Date()) === "expired";
    const scored = await closeAttempt(quiz, attemptId, answers, timedOut);
    if (scored) {
      await logActivity({
        userId,
        action: "quiz.submit",
        entity: "quiz",
        entityId: quiz.id,
        details: {
          quiz: quiz.lesson.title,
          course: quiz.lesson.course.title,
          score: scored.score,
          maxScore: scored.maxScore,
          percent: scored.percent,
          passed: scored.passed,
          timedOut,
        },
      });
      if (scored.passed) {
        await logActivity({
          userId,
          action: "quiz.pass",
          entity: "quiz",
          entityId: quiz.id,
          details: { quiz: quiz.lesson.title, course: quiz.lesson.course.title, percent: scored.percent },
        });
        const update = await completeLessonForEnrolment(attempt.enrolmentId, quiz.lesson.id);
        courseCompleted = update?.justCompleted ?? false;
      }
    }
  }

  const attempts = await loadAttempts(quiz.id, attempt.enrolmentId);
  const saved = attempts.find((a) => a.id === attemptId);
  const review = saved ? reviewOf(quiz, saved) : null;
  if (!review) return { ok: false, error: "Your answers could not be saved. Try again." };
  const lessonCompleted =
    review.passed ||
    Boolean(await db.lessonProgress.findFirst({ where: { enrolmentId: attempt.enrolmentId, lessonId: quiz.lesson.id, completedAt: { not: null } }, select: { id: true } }));
  return {
    ok: true,
    result: { ...review, attemptsLeft: attemptsLeft(quiz.attemptLimit, attempts.length), lessonCompleted, courseCompleted },
  };
}

