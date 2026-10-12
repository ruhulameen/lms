"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignEnrolment } from "@/actions/enrolment-admin";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/form-state";

type AssignEnrolmentFormProps = {
  userId: number;
  courses: { id: number; title: string; price: number }[];
  defaultCourseId?: number;
  // Where to go after assigning, e.g. "/admin/enrolments".
  doneHref: string;
};

// Pick a course for the chosen learner. Learner search is a plain GET form on the page.
export function AssignEnrolmentForm({ userId, courses, defaultCourseId, doneHref }: AssignEnrolmentFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(assignEnrolment, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      router.push(doneHref);
    }
  }, [state, router, doneHref]);

  if (courses.length === 0) {
    return <p className="text-sm text-slate-600">This learner already has every published course.</p>;
  }
  return (
    <form action={formAction} className="grid max-w-xl gap-4" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <FormField id="assign-course" label="Course" error={errors?.courseId}>
        {(aria) => (
          <select {...aria} name="courseId" defaultValue={state.values?.courseId ?? (defaultCourseId ? String(defaultCourseId) : "")} className={selectClassName} required>
            <option value="" disabled>
              Choose a course
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
                {Number(course.price) > 0 ? ` (£${course.price})` : " (free)"}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning..." : "Assign course"}
        </Button>
      </div>
    </form>
  );
}
