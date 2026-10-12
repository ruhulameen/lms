"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addLessonResource, deleteLessonResource, renameLessonResource, reorderLessonResources } from "@/actions/course-curriculum";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { LessonFileUploader } from "@/components/admin/lesson-file-uploader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RESOURCE_TITLE_MAX } from "@/lib/course-form";
import { initialFormState } from "@/lib/form-state";
import { formatBytes } from "@/lib/media-types";

type Resource = { id: number; title: string; fileName: string; size: number; url: string | null };

type LessonResourcesProps = {
  courseId: number;
  lessonId: number;
  resources: Resource[];
  canEdit: boolean;
};

// Extra downloads attached to a lesson. Each action saves at once.
export function LessonResources({ courseId, lessonId, resources, canEdit }: LessonResourcesProps) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function move(index: number, delta: -1 | 1) {
    const ids = resources.map((r) => r.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    startTransition(async () => {
      const result = await reorderLessonResources({ courseId, lessonId, resourceIds: ids });
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <section aria-label="Lesson resources" className="grid gap-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Resources</h2>
      <p className="-mt-2 text-xs text-slate-500">Extra files learners can download with this lesson, such as slides or worksheets.</p>
      {resources.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {resources.map((r, index) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-slate-500">
                  {r.fileName} · {formatBytes(r.size)}
                </p>
              </div>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline" aria-label={`Download ${r.title}`}>
                  <Download className="size-3.5" aria-hidden /> Download
                </a>
              )}
              {canEdit && (
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={pending || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${r.title} up`}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={pending || index === resources.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${r.title} down`}>
                    <ArrowDown aria-hidden />
                  </Button>
                  <RenameResource courseId={courseId} resource={r} />
                  <ConfirmDialog
                    action={deleteLessonResource}
                    fields={{ courseId: String(courseId), resourceId: String(r.id) }}
                    title={`Delete "${r.title}"?`}
                    description="The file is deleted from storage."
                    trigger={<Trash2 aria-hidden />}
                    triggerVariant="ghost"
                    triggerLabel={`Delete resource ${r.title}`}
                    confirmLabel="Delete resource"
                    destructive
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No resources yet.</p>
      )}
      {canEdit && (
        <div className="grid gap-2 rounded-lg border bg-slate-50 p-3">
          <FormField id="resource-title" label="New resource title" hint="Optional: the file name is used when empty.">
            {(aria) => <Input {...aria} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={RESOURCE_TITLE_MAX} autoComplete="off" />}
          </FormField>
          <LessonFileUploader
            courseId={courseId}
            purpose="lesson-resource"
            buttonLabel="Upload resource"
            onUploaded={async (uploaded) => {
              const result = await addLessonResource({
                courseId,
                lessonId,
                title: title.trim() || uploaded.filename.replace(/\.[^.]+$/, "").slice(0, RESOURCE_TITLE_MAX),
                fileToken: uploaded.fileToken,
              });
              if (result.ok) setTitle("");
              return result;
            }}
          />
        </div>
      )}
    </section>
  );
}

function RenameResource({ courseId, resource }: { courseId: number; resource: Resource }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Rename resource ${resource.title}`} />}>
        <Pencil aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename resource</DialogTitle>
        </DialogHeader>
        <RenameForm courseId={courseId} resource={resource} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ courseId, resource, onDone }: { courseId: number; resource: Resource; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(renameLessonResource, initialFormState);
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
      <input type="hidden" name="resourceId" value={resource.id} />
      <FormField id={`resource-rename-${resource.id}`} label="Title" error={errors?.title}>
        {(aria) => <Input {...aria} name="title" defaultValue={state.values?.title ?? resource.title} maxLength={RESOURCE_TITLE_MAX} autoComplete="off" required />}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
