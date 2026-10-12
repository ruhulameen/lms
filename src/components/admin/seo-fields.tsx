"use client";

import { useState } from "react";
import { FormField } from "@/components/admin/form-field";
import { MediaField } from "@/components/admin/media-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MediaSummary } from "@/lib/media-types";
import { META_DESCRIPTION_HINT, SEO_TITLE_HINT } from "@/lib/seo";
import { cn } from "@/lib/utils";

type SeoFieldsProps = {
  // Current values (from getSeo) or submitted values after a validation error.
  defaultValues?: {
    seoTitle?: string | null;
    metaDescription?: string | null;
    canonicalUrl?: string | null;
    noindex?: boolean;
  };
  socialImage?: MediaSummary | null;
  // fieldErrors from the action result. Parse the submission with seoFieldsSchema.
  errors?: Record<string, string[] | undefined>;
};

function LengthHint({ length, target }: { length: number; target: number }) {
  return (
    <span className={cn(length > target && "text-amber-700")}>
      {length} of about {target} characters{length > target ? ", search engines may cut it off" : ""}
    </span>
  );
}

export function SeoFields({ defaultValues, socialImage, errors }: SeoFieldsProps) {
  const [title, setTitle] = useState(defaultValues?.seoTitle ?? "");
  const [description, setDescription] = useState(defaultValues?.metaDescription ?? "");

  return (
    <fieldset className="grid gap-4 rounded-xl border bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">Search engines and sharing</legend>
      <FormField id="seo-title" label="SEO title" error={errors?.seoTitle} hint={undefined}>
        {(aria) => (
          <>
            <Input {...aria} name="seoTitle" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
            <p className="text-xs text-slate-500" aria-live="polite">
              <LengthHint length={title.length} target={SEO_TITLE_HINT} />. Leave empty to use the post title.
            </p>
          </>
        )}
      </FormField>
      <FormField id="seo-description" label="Meta description" error={errors?.metaDescription}>
        {(aria) => (
          <>
            <Textarea {...aria} name="metaDescription" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <p className="text-xs text-slate-500" aria-live="polite">
              <LengthHint length={description.length} target={META_DESCRIPTION_HINT} />
            </p>
          </>
        )}
      </FormField>
      <FormField id="seo-canonical" label="Canonical URL" error={errors?.canonicalUrl} hint="Only set this if the same content is published at another address.">
        {(aria) => (
          <Input {...aria} name="canonicalUrl" type="url" defaultValue={defaultValues?.canonicalUrl ?? ""} placeholder="https://" />
        )}
      </FormField>
      <div className="flex items-center gap-3">
        <Switch id="seo-noindex" name="noindex" defaultChecked={defaultValues?.noindex ?? false} />
        <Label htmlFor="seo-noindex">Ask search engines not to list this page (noindex)</Label>
      </div>
      <MediaField name="socialImageId" label="Social image" initial={socialImage} error={errors?.socialImageId} hint="Shown when the link is shared on social networks." />
    </fieldset>
  );
}
