"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createLesson, createModule, updateModule } from "@/actions/course-curriculum";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lessonTypeLabels, lessonTypes } from "@/lib/course";
import { MODULE_DESCRIPTION_MAX } from "@/lib/course-form";
import { initialFormState } from "@/lib/form-state";

type TriggerProps = {
  trigger: ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

function useDialog() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, close };
}

// Add a module (no `module`) or rename/describe one.
export function ModuleDialog({
  courseId,
  module,
  trigger,
  triggerLabel,
  triggerVariant = "outline",
}: TriggerProps & { courseId: number; module?: { id: number; title: string; description: string | null } }) {
  const { open, setOpen, close } = useDialog();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" aria-label={triggerLabel} />}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? "Edit module" : "New module"}</DialogTitle>
          <DialogDescription>A module groups related lessons, like a chapter.</DialogDescription>
        </DialogHeader>
        <ModuleForm courseId={courseId} module={module} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so it starts fresh each time.
function ModuleForm({
  courseId,
  module,
  onDone,
}: {
  courseId: number;
  module?: { id: number; title: string; description: string | null };
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(module ? updateModule : createModule, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {module && <input type="hidden" name="moduleId" value={module.id} />}
      <FormField id="module-title" label="Title" error={errors?.title}>
        {(aria) => <Input {...aria} name="title" defaultValue={state.values?.title ?? module?.title ?? ""} autoComplete="off" maxLength={150} required autoFocus />}
      </FormField>
      <FormField id="module-description" label="Description" error={errors?.description} hint="Optional. Shown under the module title on the course page.">
        {(aria) => (
          <Textarea {...aria} name="description" rows={3} maxLength={MODULE_DESCRIPTION_MAX} defaultValue={state.values?.description ?? module?.description ?? ""} />
        )}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : module ? "Save changes" : "Add module"}
      </Button>
    </form>
  );
}

// Add a lesson to a module: a title and a type. The rest happens in the lesson editor.
export function LessonDialog({
  courseId,
  moduleId,
  trigger,
  triggerLabel,
  triggerVariant = "outline",
}: TriggerProps & { courseId: number; moduleId: number }) {
  const { open, setOpen, close } = useDialog();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" aria-label={triggerLabel} />}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lesson</DialogTitle>
          <DialogDescription>Pick the type now; add the video, text or file afterwards. New lessons stay hidden until you publish them.</DialogDescription>
        </DialogHeader>
        <LessonForm courseId={courseId} moduleId={moduleId} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

function LessonForm({ courseId, moduleId, onDone }: { courseId: number; moduleId: number; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createLesson, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="moduleId" value={moduleId} />
      <FormField id={`lesson-title-${moduleId}`} label="Title" error={errors?.title}>
        {(aria) => <Input {...aria} name="title" defaultValue={state.values?.title ?? ""} autoComplete="off" maxLength={200} required autoFocus />}
      </FormField>
      <FormField id={`lesson-type-${moduleId}`} label="Type" error={errors?.type}>
        {(aria) => (
          <select {...aria} name="type" defaultValue={state.values?.type ?? "VIDEO"} className={selectClassName}>
            {lessonTypes.map((t) => (
              <option key={t} value={t}>
                {lessonTypeLabels[t]}
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
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add lesson"}
      </Button>
    </form>
  );
}
