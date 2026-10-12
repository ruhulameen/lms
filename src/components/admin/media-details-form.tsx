"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateMedia } from "@/actions/media";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";

type MediaDetailsFormProps = {
  media: {
    id: number;
    filename: string;
    title: string | null;
    altText: string | null;
    caption: string | null;
    description: string | null;
    isImage: boolean;
  };
  readOnly?: boolean;
};

export function MediaDetailsForm({ media, readOnly = false }: MediaDetailsFormProps) {
  const [state, formAction, pending] = useActionState(updateMedia, initialFormState);
  const errors = state.ok ? undefined : state.fieldErrors;
  const values = state.values;

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form key={state.ok ? "ok" : JSON.stringify(values)} action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={media.id} />
      <FormField
        id="media-filename"
        label="File name"
        error={errors?.originalFilename}
        hint="Changes the name shown here. The stored file and its URL stay the same."
      >
        {(aria) => (
          <Input {...aria} name="originalFilename" defaultValue={values?.originalFilename ?? media.filename} readOnly={readOnly} required />
        )}
      </FormField>
      <FormField id="media-title" label="Title" error={errors?.title}>
        {(aria) => <Input {...aria} name="title" defaultValue={values?.title ?? media.title ?? ""} readOnly={readOnly} />}
      </FormField>
      {media.isImage && (
        <FormField
          id="media-alt"
          label="Alt text"
          error={errors?.altText}
          hint="Describe the image for people who cannot see it. Leave empty for decorative images."
        >
          {(aria) => <Input {...aria} name="altText" defaultValue={values?.altText ?? media.altText ?? ""} readOnly={readOnly} />}
        </FormField>
      )}
      <FormField id="media-caption" label="Caption" error={errors?.caption}>
        {(aria) => (
          <Textarea {...aria} name="caption" rows={2} defaultValue={values?.caption ?? media.caption ?? ""} readOnly={readOnly} />
        )}
      </FormField>
      <FormField id="media-description" label="Description" error={errors?.description}>
        {(aria) => (
          <Textarea {...aria} name="description" rows={4} defaultValue={values?.description ?? media.description ?? ""} readOnly={readOnly} />
        )}
      </FormField>
      {!state.ok && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {!readOnly && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
