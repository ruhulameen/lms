import { Check, HelpCircle } from "lucide-react";
import { QuizTaker } from "@/components/learn/quiz-taker";
import { questionTypeLabels } from "@/lib/quiz";
import { getQuizPreview, getQuizSummary } from "@/services/quiz";
import { getLearnerQuizState } from "@/services/quiz-attempt";

// What the player knows about the quiz lesson being opened.
export type QuizLessonProps = {
  lessonId: number;
  lessonTitle: string;
  // The learner's enrolment, or null when this viewer's progress is not saved (preview, staff).
  enrolmentId: number | null;
  completed: boolean;
  // Course staff viewing the lesson: they see the questions and answers, read-only.
  staff?: boolean;
};

const panel = "rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={panel}>
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <HelpCircle className="size-7" aria-hidden />
      </span>
      <h2 className="mb-2 text-lg font-bold text-navy">{title}</h2>
      <div className="mx-auto max-w-md text-sm text-gray-500">{children}</div>
    </div>
  );
}

// The quiz slot of the player. Learners with an enrolment take the quiz;
// course staff get a read-only preview with the answers marked (nothing is
// stored); anyone else looking at a free-preview quiz is asked to enrol.
export async function QuizLesson({ lessonId, lessonTitle, enrolmentId, staff = false }: QuizLessonProps) {
  if (enrolmentId !== null) {
    const state = await getLearnerQuizState(enrolmentId, lessonId);
    if (state.status === "empty") {
      return (
        <Notice title="This quiz has no questions yet">
          <p>&ldquo;{lessonTitle}&rdquo; cannot be taken yet. You can carry on with the other lessons and come back later.</p>
        </Notice>
      );
    }
    return <QuizTaker lessonId={lessonId} state={state} />;
  }

  if (staff) {
    const quiz = await getQuizPreview(lessonId);
    if (!quiz || quiz.questions.length === 0) {
      return (
        <Notice title="This quiz has no questions yet">
          <p>Add questions in the quiz builder.</p>
        </Notice>
      );
    }
    return (
      <div className="space-y-5">
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Staff preview: {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}, pass mark {quiz.passingScore}%
          {quiz.timeLimitMinutes ? `, ${quiz.timeLimitMinutes} minute time limit` : ", no time limit"}
          {quiz.attemptLimit ? `, ${quiz.attemptLimit} attempts` : ", unlimited attempts"}. Correct answers are marked. Enrolled learners do not see them until they submit; nothing is saved here.
        </p>
        <ol className="space-y-4">
          {quiz.questions.map((question, index) => (
            <li key={question.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="mb-1 text-sm font-bold whitespace-pre-line text-navy">
                <span className="mr-2 text-gray-400">{index + 1}.</span>
                {question.text}
              </p>
              <p className="mb-3 text-xs text-gray-500">
                {questionTypeLabels[question.type]} · {question.points} {question.points === 1 ? "point" : "points"}
              </p>
              <ul className="space-y-1.5">
                {question.options.map((option) => (
                  <li
                    key={option.id}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${option.correct ? "border-green-200 bg-green-50 text-green-900" : "border-gray-100 text-gray-600"}`}
                  >
                    <span className="mt-0.5 size-4 shrink-0">{option.correct && <Check className="size-4" aria-hidden />}</span>
                    <span>
                      {option.text}
                      {option.correct && <span className="sr-only"> (correct answer)</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {question.explanation && <p className="mt-3 text-sm text-gray-600">Explanation: {question.explanation}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const summary = await getQuizSummary(lessonId);
  return (
    <Notice title="Enrol to take this quiz">
      <p>
        &ldquo;{lessonTitle}&rdquo;
        {summary && summary.questionCount > 0
          ? ` has ${summary.questionCount} ${summary.questionCount === 1 ? "question" : "questions"} and a pass mark of ${summary.passingScore}%.`
          : " is part of this course."}{" "}
        Enrol in the course to take it and keep your result.
      </p>
    </Notice>
  );
}
