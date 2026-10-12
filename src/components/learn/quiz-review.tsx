import { Check, CircleCheck, CircleX } from "lucide-react";
import type { SnapshotQuestion } from "@/lib/quiz";
import { cn } from "@/lib/utils";

// The learner's answers beside the correct ones, for an attempt that has been
// submitted. Meaning is never carried by colour alone: every marker has text.
export function QuizReview({ questions }: { questions: SnapshotQuestion[] }) {
  return (
    <ol className="space-y-5">
      {questions.map((question, index) => {
        const answered = question.selected.length > 0;
        return (
          <li key={question.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold whitespace-pre-line text-navy">
                <span className="mr-2 text-gray-400">{index + 1}.</span>
                {question.text}
              </p>
              {question.correct ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                  <CircleCheck className="size-3.5" aria-hidden /> Correct · {question.earned}/{question.points}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                  <CircleX className="size-3.5" aria-hidden /> {answered ? "Incorrect" : "Not answered"} · 0/{question.points}
                </span>
              )}
            </div>
            <ul className="space-y-1.5">
              {question.options.map((option) => {
                const chosen = question.selected.includes(option.id);
                return (
                  <li
                    key={option.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                      option.correct ? "border-green-200 bg-green-50 text-green-900" : chosen ? "border-red-200 bg-red-50 text-red-900" : "border-gray-100 text-gray-600",
                    )}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {option.correct ? <Check className="size-4" aria-hidden /> : chosen ? <CircleX className="size-4" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{option.text}</span>
                    {(chosen || option.correct) && (
                      <span className="shrink-0 text-xs font-bold">
                        {chosen && "Your answer"}
                        {chosen && option.correct && " · "}
                        {option.correct && "Correct answer"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {question.explanation && (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span className="font-bold">Explanation: </span>
                {question.explanation}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
