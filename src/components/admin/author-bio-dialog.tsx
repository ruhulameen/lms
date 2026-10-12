"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateAuthorBio } from "@/actions/author";
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
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";

export function AuthorBioDialog({ author }: { author: { id: number; name: string; bio: string | null } }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Edit bio of ${author.name}`} />}>
        Edit bio
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bio of {author.name}</DialogTitle>
          <DialogDescription>Shown under their articles on the public blog.</DialogDescription>
        </DialogHeader>
        <BioForm author={author} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

function BioForm({ author, onDone }: { author: { id: number; bio: string | null }; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updateAuthorBio, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const [bio, setBio] = useState(state.values?.bio ?? author.bio ?? "");

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={author.id} />
      <FormField id="author-bio" label="Bio" error={errors?.bio} hint="A sentence or two. Leave empty to show no bio.">
        {(aria) => <Textarea {...aria} name="bio" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save bio"}
      </Button>
    </form>
  );
}
