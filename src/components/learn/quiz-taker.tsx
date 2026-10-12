"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, CircleCheck, CircleX, Clock, HelpCircle, Timer } from "lucide-react";
import { startQuizAttempt, submitQuizAttempt } from "@/actions/quiz-attempt";
import { QuizReview } from "@/components/learn/quiz-review";
import { formatCountdown, type Answers } from "@/lib/quiz";
import { cn } from "@/lib/utils";
import type { LearnerQuizState, OpenAttemptView, SubmitView } from "@/services/quiz-attempt";

type ReadyState = Extract<LearnerQuizState, { status: "ready" }>;

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The quiz in the course player: intro, the questions with a countdown, the
// result and the review. All scoring is on the server; this component only
// collects answers. `state` comes from the server and is refreshed after each
// submission; the view (intro / taking / result) is local.
export function QuizTaker({ lessonId, state }: { lessonId: number; state: ReadyState }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<OpenAttemptView | null>(state.open);
  const [result, setResult] = useState<SubmitView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const response = await startQuizAttempt(lessonId);
      if (!response.ok) return setError(response.error);
      setResult(null);
      setAttempt(response.data.attempt);
    });
  }

  if (attempt) {
    return (
      <Attempt
        key={attempt.id}
        attempt={attempt}
        onSubmitted={(submitted) => {
          setAttempt(null);
          setResult(submitted);
          router.refresh();
        }}
      />
    );
  }

  if (result) {
    return (
      <ResultView
        result={result}
        passingScore={state.passingScore}
        canRetry={result.attemptsLeft === null || result.attemptsLeft > 0}
        starting={starting}
        error={error}
        onRetry={start}
        onClose={() => setResult(null)}
      />
    );
  }

  return <Intro state={state} starting={starting} error={error} onStart={start} />;
}

function Intro({ state, starting, error, onStart }: { state: ReadyState; starting: boolean; error: string | null; onStart: () => void }) {
  const outOfAttempts = state.attemptsLeft === 0;
  const facts = [
    { label: "Questions", value: String(state.questionCount) },
    { label: "Pass mark", value: `${state.passingScore}%` },
    { label: "Time limit", value: state.timeLimitMinutes ? `${state.timeLimitMinutes} min` : "None" },
    {
      label: "Attempts",
      value: state.attemptLimit === null ? `${state.attemptsUsed} used` : `${state.attemptsUsed} of ${state.attemptLimit} used`,
    },
    { label: "Best score", value: state.bestPercent === null ? "None yet" : `${state.bestPercent}%` },
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <HelpCircle className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-navy">{state.passed ? "You have passed this quiz" : "Test your knowledge"}</h2>
            <p className="text-sm text-gray-500">
              {state.totalPoints} {state.totalPoints === 1 ? "point" : "points"} available. You need {state.passingScore}% to pass.
            </p>
          </div>
        </div>
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-lg bg-slate-50 px-3 py-2.5">
              <dt className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">{fact.label}</dt>
              <dd className="text-sm font-bold text-navy">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {state.timeLimitMinutes && (
          <p className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            <Timer className="size-4 text-blue-600" aria-hidden />
            The clock starts when you press the button and keeps running if you leave the page.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={starting || outOfAttempts}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? "Starting…" : state.attemptsUsed === 0 ? "Start quiz" : "Try again"}
          </button>
          {outOfAttempts && <p className="text-sm text-gray-500">You have used all your attempts.</p>}
          {state.attemptsLeft !== null && state.attemptsLeft > 0 && (
            <p className="text-sm text-gray-500">{plural(state.attemptsLeft, "attempt")} left.</p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      {state.history.length > 0 && (
        <section aria-labelledby="quiz-history" className="rounded-2xl border border-gray-200 bg-white">
          <h2 id="quiz-history" className="border-b border-gray-100 px-6 py-4 text-base font-bold text-navy">
            Your attempts
          </h2>
          <ul className="divide-y divide-gray-100">
            {state.history.map((item, index) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm">
                <span className="font-semibold text-navy">Attempt {index + 1}</span>
                <span className="text-gray-500">{dateFormatter.format(new Date(item.submittedAt))}</span>
                <span className="text-gray-600">
                  {item.score}/{item.maxScore} points · {item.percent}%
                </span>
                {item.timedOut && <span className="text-xs font-bold text-amber-700">Out of time</span>}
                <span className={cn("ml-auto flex items-center gap-1 text-xs font-bold", item.passed ? "text-green-700" : "text-red-700")}>
                  {item.passed ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                  {item.passed ? "Passed" : "Not passed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.latest && (
        <details className="rounded-2xl border border-gray-200 bg-white" open={false}>
          <summary className="cursor-pointer px-6 py-4 text-base font-bold text-navy outline-none focus-visible:ring-3 focus-visible:ring-blue-600/40">
            Review your last attempt
          </summary>
          <div className="px-6 pb-6">
            <QuizReview questions={state.latest.questions} />
          </div>
        </details>
      )}
    </div>
  );
}

function Attempt({ attempt, onSubmitted }: { attempt: OpenAttemptView; onSubmitted: (result: SubmitView) => void }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [remaining, setRemaining] = useState<number | null>(attempt.secondsLeft);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();
  const sent = useRef(false);
  // The timer submits whatever is chosen at that moment.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const unanswered = attempt.questions.filter((q) => (answers[String(q.id)] ?? []).length === 0).length;

  function submit() {
    if (sent.current) return;
    sent.current = true;
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const response = await submitQuizAttempt({ attemptId: attempt.id, answers: answersRef.current });
      if (!response.ok) {
        sent.current = false;
        setError(response.error);
        return;
      }
      onSubmitted(response.data.result);
    });
  }

  // Counts down from what the server said; submits by itself at zero.
  useEffect(() => {
    if (attempt.secondsLeft === null) return;
    const end = Date.now() + attempt.secondsLeft * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) submit();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // submit() reads refs and stable setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.secondsLeft]);

  function choose(questionId: number, optionId: string, multiple: boolean, checked: boolean) {
    setAnswers((current) => {
      const key = String(questionId);
      const now = current[key] ?? [];
      if (!multiple) return { ...current, [key]: [optionId] };
      return { ...current, [key]: checked ? [...now, optionId] : now.filter((id) => id !== optionId) };
    });
  }

  const low = remaining !== null && remaining <= 60;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (unanswered > 0) setConfirming(true);
        else submit();
      }}
      className="space-y-5"
    >
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <p className="text-sm font-semibold text-navy" aria-live="polite">
          {attempt.questions.length - unanswered} of {attempt.questions.length} answered
        </p>
        {remaining !== null && (
          <p
            role="timer"
            aria-label={`Time left ${formatCountdown(remaining)}`}
            className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold tabular-nums", low ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700")}
          >
            <Clock className="size-4" aria-hidden />
            {formatCountdown(remaining)}
          </p>
        )}
      </div>

      {attempt.questions.map((question, index) => {
        const multiple = question.type === "MULTIPLE_CHOICE";
        const chosen = answers[String(question.id)] ?? [];
        return (
          <fieldset key={question.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <legend className="sr-only">Question {index + 1}</legend>
            <p className="mb-1 text-sm font-bold whitespace-pre-line text-navy">
              <span className="mr-2 text-gray-400">{index + 1}.</span>
              {question.text}
            </p>
            <p className="mb-3 text-xs text-gray-500">
              {multiple ? "Select all that apply." : "Select one answer."} {plural(question.points, "point")}.
            </p>
            <div className="space-y-2">
              {question.options.map((option) => {
                const checked = chosen.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition has-focus-visible:ring-3 has-focus-visible:ring-blue-600/40",
                      checked ? "border-blue-400 bg-blue-50 text-navy" : "border-gray-200 text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name={`q-${question.id}`}
                      value={option.id}
                      checked={checked}
                      onChange={(event) => choose(question.id, option.id, multiple, event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-blue-600"
                    />
                    <span className="min-w-0 flex-1">{option.text}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {confirming && (
        <div role="alertdialog" aria-labelledby="quiz-confirm" className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p id="quiz-confirm" className="mb-3 text-sm font-semibold text-amber-900">
            You have not answered {plural(unanswered, "question")}. Unanswered questions score zero. Submit anyway?
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={submit} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
              Submit anyway
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
              Keep answering
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-center">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-green-600 px-8 py-3 text-sm font-bold text-white transition outline-none hover:bg-green-700 focus-visible:ring-3 focus-visible:ring-green-600/40 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit answers"}
        </button>
      </div>
    </form>
  );
}

function ResultView({
  result,
  passingScore,
  canRetry,
  starting,
  error,
  onRetry,
  onClose,
}: {
  result: SubmitView;
  passingScore: number;
  canRetry: boolean;
  starting: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="quiz-result"
        className={cn("rounded-2xl border p-6 text-center sm:p-8", result.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}
      >
        <span className={cn("mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-white", result.passed ? "text-green-600" : "text-red-600")}>
          {result.passed ? <CircleCheck className="size-8" aria-hidden /> : <CircleX className="size-8" aria-hidden />}
        </span>
        <h2 id="quiz-result" className="text-xl font-extrabold text-navy">
          {result.passed ? "You passed" : "Not passed this time"}
        </h2>
        <p className="mt-1 text-sm text-gray-700">
          You scored {result.score} out of {result.maxScore} points ({result.percent}%). The pass mark is {passingScore}%.
        </p>
        {result.timedOut && <p className="mt-2 text-sm font-semibold text-amber-800">Time ran out before your answers were received, so this attempt scored zero.</p>}
        {result.feedback && <p className="mx-auto mt-3 max-w-xl text-sm whitespace-pre-line text-gray-800">{result.feedback}</p>}
        {result.passed && <p className="mt-3 text-sm font-bold text-green-700">This lesson is now complete.</p>}
        {result.courseCompleted && (
          <p className="mt-3">
            <Link href="/my-certificates" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
              <Award className="size-4" aria-hidden /> You finished the course: see your certificate
            </Link>
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={starting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {starting ? "Starting…" : "Try again"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
            Back to the quiz summary
          </button>
        </div>
        {!canRetry && <p className="mt-3 text-xs text-gray-500">You have used all your attempts.</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </section>

      <section aria-labelledby="quiz-review">
        <h2 id="quiz-review" className="mb-3 text-lg font-bold text-navy">
          Review your answers
        </h2>
        <QuizReview questions={result.questions} />
      </section>
    </div>
  );
}
