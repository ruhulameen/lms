"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createFolder, renameFolder } from "@/actions/media";
import { FormField } from "@/components/admin/form-field";
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
import { initialFormState } from "@/lib/form-state";

type FolderFormDialogProps = {
  // Rename this folder; omit to create a folder inside `parentId`.
  folder?: { id: number; name: string };
  parentId?: number | null;
  trigger: ReactNode;
  triggerLabel?: string;
};

export function FolderFormDialog({ folder, parentId = null, trigger, triggerLabel }: FolderFormDialogProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={triggerLabel} />}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{folder ? `Rename "${folder.name}"` : "New folder"}</DialogTitle>
          <DialogDescription>Folder names must be unique within their parent folder.</DialogDescription>
        </DialogHeader>
        <FolderForm folder={folder} parentId={parentId} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so it starts fresh each time.
function FolderForm({
  folder,
  parentId,
  onDone,
}: {
  folder?: { id: number; name: string };
  parentId: number | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(folder ? renameFolder : createFolder, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form key={state.ok ? "ok" : JSON.stringify(values)} action={formAction} className="grid gap-4" noValidate>
      {folder && <input type="hidden" name="id" value={folder.id} />}
      {!folder && parentId !== null && <input type="hidden" name="parentId" value={parentId} />}
      <FormField id="folder-name" label="Name" error={errors?.name}>
        {(aria) => (
          <Input {...aria} name="name" defaultValue={values?.name ?? folder?.name} autoComplete="off" required />
        )}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : folder ? "Rename folder" : "Create folder"}
      </Button>
    </form>
  );
}
