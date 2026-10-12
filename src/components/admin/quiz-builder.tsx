"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteQuestion, moveQuestion, saveQuestion, saveQuizSettings } from "@/actions/quiz";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { questionTypes } from "@/lib/course";
import { initialFormState } from "@/lib/form-state";
import {
  ATTEMPT_LIMIT_MAX,
  FEEDBACK_MAX,
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_TEXT_MAX,
  QUESTION_EXPLANATION_MAX,
  QUESTION_POINTS_MAX,
  QUESTION_TEXT_MAX,
  TIME_LIMIT_MAX_MINUTES,
  TRUE_FALSE_OPTIONS,
  optionsError,
  questionTypeLabels,
  type QuestionTypeValue,
  type QuizOption,
} from "@/lib/quiz";
import { cn } from "@/lib/utils";

export type QuizBuilderQuestion = {
  id: number;
  type: QuestionTypeValue;
  text: string;
  explanation: string | null;
  points: number;
  options: QuizOption[];
};

export type QuizBuilderSettings = {
  passingScore: number;
  attemptLimit: number | null;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  passFeedback: string | null;
  failFeedback: string | null;
};

type QuizBuilderProps = {
  courseId: number;
  lessonId: number;
  // Where the course screens live (/admin/courses); used for the preview link.
  basePath: string;
  canEdit: boolean;
  settings: QuizBuilderSettings;
  questions: QuizBuilderQuestion[];
  // Attempts already made; edits apply to future attempts only.
  attemptCount: number;
};

// Settings and questions of one quiz lesson. Everything saves on its own
// through the quiz actions; the server checks the course and the lesson.
export function QuizBuilder({ courseId, lessonId, basePath, canEdit, settings, questions, attemptCount }: QuizBuilderProps) {
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  return (
    <div className="grid gap-5">
      <SettingsForm courseId={courseId} lessonId={lessonId} settings={settings} canEdit={canEdit} attemptCount={attemptCount} />

      <section aria-labelledby="quiz-questions" className="rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6">
          <div>
            <h2 id="quiz-questions" className="text-base font-bold text-slate-900">
              Questions
            </h2>
            <p className="text-sm text-slate-500">
              {questions.length} {questions.length === 1 ? "question" : "questions"}, {totalPoints} {totalPoints === 1 ? "point" : "points"} in total
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href={`${basePath}/${courseId}/preview/lessons/${lessonId}`} />}>
              <Eye aria-hidden /> Preview
            </Button>
            {canEdit && <QuestionDialog courseId={courseId} lessonId={lessonId} trigger={<><Plus aria-hidden /> Add question</>} />}
          </div>
        </div>
        {questions.length === 0 ? (
          <p className="border-t p-6 text-center text-sm text-slate-500">No questions yet. Add at least one before you publish this lesson.</p>
        ) : (
          <ol className="divide-y border-t">
            {questions.map((question, index) => (
              <QuestionRow
                key={question.id}
                courseId={courseId}
                lessonId={lessonId}
                question={question}
                index={index}
                isFirst={index === 0}
                isLast={index === questions.length - 1}
                canEdit={canEdit}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function SettingsForm({
  courseId,
  lessonId,
  settings,
  canEdit,
  attemptCount,
}: {
  courseId: number;
  lessonId: number;
  settings: QuizBuilderSettings;
  canEdit: boolean;
  attemptCount: number;
}) {
  const [state, formAction, pending] = useActionState(saveQuizSettings, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;
  const [shuffle, setShuffle] = useState(settings.shuffleQuestions);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5 rounded-xl border bg-white p-4 sm:p-6" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <div>
        <h2 className="text-base font-bold text-slate-900">Quiz settings</h2>
        {attemptCount > 0 && (
          <p className="mt-1 text-sm text-slate-500">
            Learners have made {attemptCount} {attemptCount === 1 ? "attempt" : "attempts"} at this quiz. Changes apply to attempts made from now on; their earlier results keep the questions they saw.
          </p>
        )}
      </div>
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-5">
        <legend className="sr-only">Quiz settings</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="quiz-passing" label="Passing score (%)" error={errors?.passingScore}>
            {(aria) => <Input {...aria} name="passingScore" inputMode="numeric" defaultValue={values?.passingScore ?? String(settings.passingScore)} className="w-28" required />}
          </FormField>
          <FormField id="quiz-attempts" label="Attempt limit" error={errors?.attemptLimit} hint={`Leave empty for unlimited attempts (up to ${ATTEMPT_LIMIT_MAX}).`}>
            {(aria) => <Input {...aria} name="attemptLimit" inputMode="numeric" defaultValue={values?.attemptLimit ?? (settings.attemptLimit?.toString() ?? "")} className="w-28" placeholder="Unlimited" />}
          </FormField>
          <FormField id="quiz-time" label="Time limit (minutes)" error={errors?.timeLimitMinutes} hint={`Leave empty for no limit (up to ${TIME_LIMIT_MAX_MINUTES}).`}>
            {(aria) => <Input {...aria} name="timeLimitMinutes" inputMode="numeric" defaultValue={values?.timeLimitMinutes ?? (settings.timeLimitMinutes?.toString() ?? "")} className="w-28" placeholder="No limit" />}
          </FormField>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="quiz-shuffle" checked={shuffle} onCheckedChange={setShuffle} />
          <input type="hidden" name="shuffleQuestions" value={shuffle ? "on" : ""} />
          <Label htmlFor="quiz-shuffle">Shuffle the order of the questions for each attempt</Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="quiz-pass-feedback" label="Message when passed" error={errors?.passFeedback} hint="Optional. Shown with the result.">
            {(aria) => <Textarea {...aria} name="passFeedback" rows={3} maxLength={FEEDBACK_MAX} defaultValue={values?.passFeedback ?? settings.passFeedback ?? ""} />}
          </FormField>
          <FormField id="quiz-fail-feedback" label="Message when not passed" error={errors?.failFeedback} hint="Optional. Shown with the result.">
            {(aria) => <Textarea {...aria} name="failFeedback" rows={3} maxLength={FEEDBACK_MAX} defaultValue={values?.failFeedback ?? settings.failFeedback ?? ""} />}
          </FormField>
        </div>
      </fieldset>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {canEdit && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save settings"}
          </Button>
        </div>
      )}
    </form>
  );
}

function QuestionRow({
  courseId,
  lessonId,
  question,
  index,
  isFirst,
  isLast,
  canEdit,
}: {
  courseId: number;
  lessonId: number;
  question: QuizBuilderQuestion;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  function move(direction: -1 | 1) {
    startTransition(async () => {
      const result = await moveQuestion({ courseId, lessonId, questionId: question.id, direction });
      if (!result.ok) toast.error(result.error);
    });
  }
  return (
    <li className="flex flex-col gap-3 p-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium whitespace-pre-line text-slate-900">{question.text}</p>
          <p className="mt-1 text-xs text-slate-500">
            {questionTypeLabels[question.type]} · {question.points} {question.points === 1 ? "point" : "points"}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" disabled={isFirst || pending} onClick={() => move(-1)} aria-label={`Move question ${index + 1} up`}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={isLast || pending} onClick={() => move(1)} aria-label={`Move question ${index + 1} down`}>
              <ArrowDown aria-hidden />
            </Button>
            <QuestionDialog
              courseId={courseId}
              lessonId={lessonId}
              question={question}
              trigger={<Pencil aria-hidden />}
              triggerLabel={`Edit question ${index + 1}`}
              triggerVariant="ghost"
              triggerSize="icon-sm"
            />
            <ConfirmDialog
              action={deleteQuestion}
              fields={{ courseId: String(courseId), lessonId: String(lessonId), questionId: String(question.id) }}
              title={`Delete question ${index + 1}?`}
              description="Learners' earlier results keep their own copy of this question. New attempts will not include it."
              trigger={<Trash2 aria-hidden />}
              triggerVariant="ghost"
              triggerLabel={`Delete question ${index + 1}`}
              confirmLabel="Delete question"
              destructive
            />
          </div>
        )}
      </div>
      <ul className="ml-9 grid gap-1 text-sm">
        {question.options.map((option) => (
          <li key={option.id} className={cn("flex items-start gap-2", option.correct ? "font-medium text-emerald-800" : "text-slate-600")}>
            {option.correct ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <span className="size-4 shrink-0" aria-hidden />}
            <span>
              {option.text}
              {option.correct && <span className="sr-only"> (correct answer)</span>}
            </span>
          </li>
        ))}
      </ul>
      {question.explanation && <p className="ml-9 text-xs text-slate-500">Explanation: {question.explanation}</p>}
    </li>
  );
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);
const blankOption = (): QuizOption => ({ id: newId(), text: "", correct: false });
const trueFalse = (trueIsCorrect: boolean): QuizOption[] => TRUE_FALSE_OPTIONS.map((o, i) => ({ ...o, correct: i === 0 ? trueIsCorrect : !trueIsCorrect }));

// Add a question (no `question`) or edit one.
function QuestionDialog({
  courseId,
  lessonId,
  question,
  trigger,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
}: {
  courseId: number;
  lessonId: number;
  question?: QuizBuilderQuestion;
  trigger: React.ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerSize?: "sm" | "icon-sm";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} aria-label={triggerLabel} />}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "New question"}</DialogTitle>
          <DialogDescription>Learners see the question and the answers; the correct ones and the explanation appear after they submit.</DialogDescription>
        </DialogHeader>
        <QuestionForm courseId={courseId} lessonId={lessonId} question={question} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so it starts fresh each time.
function QuestionForm({ courseId, lessonId, question, onDone }: { courseId: number; lessonId: number; question?: QuizBuilderQuestion; onDone: () => void }) {
  const [type, setType] = useState<QuestionTypeValue>(question?.type ?? "SINGLE_CHOICE");
  const [text, setText] = useState(question?.text ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [options, setOptions] = useState<QuizOption[]>(
    question ? question.options : [blankOption(), blankOption()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeType(next: QuestionTypeValue) {
    if (next === type) return;
    if (next === "TRUE_FALSE") {
      setOptions(trueFalse(true));
    } else if (type === "TRUE_FALSE") {
      setOptions([blankOption(), blankOption()]);
    } else if (next === "SINGLE_CHOICE") {
      // Only one answer can stay marked.
      const first = options.findIndex((o) => o.correct);
      setOptions(options.map((o, i) => ({ ...o, correct: i === first })));
    }
    setType(next);
  }

  function setCorrect(id: string, correct: boolean) {
    setOptions((current) => current.map((o) => (type === "MULTIPLE_CHOICE" ? (o.id === id ? { ...o, correct } : o) : { ...o, correct: o.id === id })));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const numericPoints = Number(points);
    if (!/^\d{1,3}$/.test(points) || numericPoints < 1 || numericPoints > QUESTION_POINTS_MAX) {
      setError(`Points must be a whole number from 1 to ${QUESTION_POINTS_MAX}.`);
      return;
    }
    const problem = optionsError(type, options);
    if (!text.trim()) return setError("Enter the question.");
    if (problem) return setError(problem);
    startTransition(async () => {
      const result = await saveQuestion({
        courseId,
        lessonId,
        questionId: question?.id,
        question: { type, text, explanation, points: numericPoints, options },
      });
      if (!result.ok) return setError(result.error);
      if (result.message) toast.success(result.message);
      onDone();
    });
  }

  const idPrefix = question ? `question-${question.id}` : "question-new";
  const trueIsCorrect = options[0]?.correct ?? true;

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField id={`${idPrefix}-type`} label="Type">
          {(aria) => (
            <select {...aria} value={type} onChange={(e) => changeType(e.target.value as QuestionTypeValue)} className={selectClassName}>
              {questionTypes.map((t) => (
                <option key={t} value={t}>
                  {questionTypeLabels[t]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField id={`${idPrefix}-points`} label="Points">
          {(aria) => <Input {...aria} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />}
        </FormField>
      </div>
      <FormField id={`${idPrefix}-text`} label="Question">
        {(aria) => <Textarea {...aria} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={QUESTION_TEXT_MAX} autoFocus />}
      </FormField>

      {type === "TRUE_FALSE" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm leading-none font-medium">The statement is</legend>
          {TRUE_FALSE_OPTIONS.map((option, i) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${idPrefix}-tf`}
                checked={i === 0 ? trueIsCorrect : !trueIsCorrect}
                onChange={() => setOptions(trueFalse(i === 0))}
                className="size-4 accent-blue-600"
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm leading-none font-medium">
            Answers <span className="font-normal text-slate-500">({type === "SINGLE_CHOICE" ? "mark the one correct answer" : "mark every correct answer"})</span>
          </legend>
          {options.map((option, i) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                name={`${idPrefix}-correct`}
                checked={option.correct}
                onChange={(e) => setCorrect(option.id, e.target.checked)}
                aria-label={`Answer ${i + 1} is correct`}
                className="size-4 shrink-0 accent-blue-600"
              />
              <Input
                value={option.text}
                onChange={(e) => setOptions((current) => current.map((o) => (o.id === option.id ? { ...o, text: e.target.value } : o)))}
                maxLength={OPTION_TEXT_MAX}
                aria-label={`Answer ${i + 1}`}
                placeholder={`Answer ${i + 1}`}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={options.length <= MIN_OPTIONS}
                onClick={() => setOptions((current) => current.filter((o) => o.id !== option.id))}
                aria-label={`Remove answer ${i + 1}`}
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="outline" size="sm" disabled={options.length >= MAX_OPTIONS} onClick={() => setOptions((current) => [...current, blankOption()])}>
              <Plus aria-hidden /> Add answer
            </Button>
          </div>
        </fieldset>
      )}

      <FormField id={`${idPrefix}-explanation`} label="Explanation" hint="Optional. Shown with the correct answer when the learner reviews their attempt.">
        {(aria) => <Textarea {...aria} value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} maxLength={QUESTION_EXPLANATION_MAX} />}
      </FormField>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : question ? "Save question" : "Add question"}
      </Button>
    </form>
  );
}
