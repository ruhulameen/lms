"use client";

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createBlogCategory, createBlogTag, updateBlogCategory, updateBlogTag } from "@/actions/blog-taxonomy";
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
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";
import { slugify } from "@/lib/slug";

type TaxonomyFormDialogProps = {
  kind: "category" | "tag";
  // Existing item to edit; omit to create one.
  item?: { id: number; name: string; slug: string; description?: string | null };
  trigger: ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

export function TaxonomyFormDialog({ kind, item, trigger, triggerLabel, triggerVariant = "outline" }: TaxonomyFormDialogProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" aria-label={triggerLabel} />}>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${kind}` : `New ${kind}`}</DialogTitle>
          <DialogDescription>
            The slug is the last part of the public address. It must be unique among {kind === "tag" ? "tags" : "categories"}.
          </DialogDescription>
        </DialogHeader>
        <TaxonomyForm kind={kind} item={item} onDone={close} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so it starts fresh each time.
function TaxonomyForm({ kind, item, onDone }: { kind: "category" | "tag"; item?: TaxonomyFormDialogProps["item"]; onDone: () => void }) {
  const action = kind === "category" ? (item ? updateBlogCategory : createBlogCategory) : item ? updateBlogTag : createBlogTag;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  const [name, setName] = useState(values?.name ?? item?.name ?? "");
  const [slug, setSlug] = useState(values?.slug ?? item?.slug ?? "");
  // A slug the user typed stays; otherwise it follows the name.
  const [slugTouched, setSlugTouched] = useState(Boolean(item));

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormField id={`${kind}-name`} label="Name" error={errors?.name}>
        {(aria) => (
          <Input
            {...aria}
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            autoComplete="off"
            required
          />
        )}
      </FormField>
      <FormField id={`${kind}-slug`} label="Slug" error={errors?.slug}>
        {(aria) => (
          <Input
            {...aria}
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            autoComplete="off"
            required
          />
        )}
      </FormField>
      {kind === "category" && (
        <FormField id="category-description" label="Description" error={errors?.description}>
          {(aria) => <Textarea {...aria} name="description" rows={3} defaultValue={values?.description ?? item?.description ?? ""} />}
        </FormField>
      )}
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : item ? "Save changes" : `Create ${kind}`}
      </Button>
    </form>
  );
}
