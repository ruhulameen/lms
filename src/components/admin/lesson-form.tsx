"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateLesson } from "@/actions/course-curriculum";
import { FormField } from "@/components/admin/form-field";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { lessonNeedsFile, type LessonTypeValue } from "@/lib/course";
import { LESSON_TITLE_MAX, splitSeconds } from "@/lib/course-form";
import { initialFormState } from "@/lib/form-state";
import type { RichTextDocument } from "@/lib/rich-text";

type LessonFormProps = {
  courseId: number;
  lesson: {
    id: number;
    title: string;
    slug: string;
    type: LessonTypeValue;
    content: RichTextDocument | null;
    isFreePreview: boolean;
    published: boolean;
    durationSeconds: number | null;
    // Video and document lessons: whether the file is attached.
    hasFile: boolean | null;
    // Quiz lessons: how many questions the quiz has.
    questionCount: number | null;
  };
  canEdit: boolean;
};

// The text fields of a lesson. Files and resources save on their own (see
// LessonFileSection and LessonResources); this form saves the rest.
export function LessonForm({ courseId, lesson, canEdit }: LessonFormProps) {
  const [state, formAction, pending] = useActionState(updateLesson, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;
  const [published, setPublished] = useState(lesson.published);
  const [freePreview, setFreePreview] = useState(lesson.isFreePreview);
  const duration = splitSeconds(lesson.durationSeconds);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  const needsFile = lessonNeedsFile(lesson.type);
  const hasContent = lesson.type !== "QUIZ";

  return (
    <form action={formAction} className="grid min-w-0 gap-5 rounded-xl border bg-white p-4 sm:p-6" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lesson.id} />
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-5">
        <legend className="sr-only">Lesson details</legend>
        <FormField id="lesson-title" label="Title" error={errors?.title}>
          {(aria) => <Input {...aria} name="title" defaultValue={values?.title ?? lesson.title} maxLength={LESSON_TITLE_MAX} autoComplete="off" required className="h-10 text-base" />}
        </FormField>
        <FormField id="lesson-slug" label="Slug" error={errors?.slug} hint="Used in the lesson address. Unique within the course.">
          {(aria) => <Input {...aria} name="slug" defaultValue={values?.slug ?? lesson.slug} autoComplete="off" required />}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Length</span>
            <div key={lesson.durationSeconds ?? 0} className="flex items-center gap-2">
              <Input name="durationMinutes" inputMode="numeric" defaultValue={values?.durationMinutes ?? duration.minutes} className="w-20" aria-label="Minutes" placeholder="0" />
              <span className="text-sm text-slate-500">min</span>
              <Input name="durationSeconds" inputMode="numeric" defaultValue={values?.durationSeconds ?? duration.seconds} className="w-20" aria-label="Seconds" placeholder="0" />
              <span className="text-sm text-slate-500">sec</span>
            </div>
            {(errors?.durationMinutes || errors?.durationSeconds) && (
              <p role="alert" className="text-sm text-destructive">
                {errors?.durationMinutes?.[0] ?? errors?.durationSeconds?.[0]}
              </p>
            )}
            <p className="text-xs text-slate-500">{lesson.type === "VIDEO" ? "Filled in from the video when you upload it. Change it if it is wrong." : "Optional. Shown on the course page."}</p>
          </div>

          <div className="grid content-start gap-3">
            <div className="flex items-center gap-3">
              <Switch id="lesson-free-preview" checked={freePreview} onCheckedChange={setFreePreview} />
              <input type="hidden" name="isFreePreview" value={freePreview ? "on" : ""} />
              <Label htmlFor="lesson-free-preview">Free preview (anyone can open it)</Label>
            </div>
            <div className="grid gap-1">
              <div className="flex items-center gap-3">
                <Switch id="lesson-published" checked={published} onCheckedChange={setPublished} />
                <input type="hidden" name="published" value={published ? "on" : ""} />
                <Label htmlFor="lesson-published">Published (visible to learners)</Label>
              </div>
              {needsFile && lesson.hasFile === false && <p className="text-xs text-amber-800">Upload the file below before publishing.</p>}
              {lesson.questionCount === 0 && <p className="text-xs text-amber-800">Add a question in the quiz builder below before publishing.</p>}
              {errors?.published && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.published[0]}
                </p>
              )}
            </div>
          </div>
        </div>

        {hasContent ? (
          <RichTextEditor
            name="content"
            label={lesson.type === "TEXT" ? "Lesson content" : "Notes (optional)"}
            initialValue={lesson.content}
            error={errors?.content}
          />
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-slate-600">
            Questions, passing score, attempts and time limit are set in the quiz builder below. Add questions there before you publish this lesson.
          </p>
        )}
      </fieldset>

      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {canEdit && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save lesson"}
          </Button>
        </div>
      )}
    </form>
  );
}
