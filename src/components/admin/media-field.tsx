"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { MediaPicker } from "@/components/admin/media-picker";
import { MediaThumb } from "@/components/admin/media-thumb";
import { Button } from "@/components/ui/button";
import type { MediaKindValue, MediaSummary } from "@/lib/media-types";

type MediaFieldProps = {
  // Form field name; the media id (or empty) is submitted under it.
  name: string;
  label: string;
  // Current selection, loaded on the server with getMediaSummary().
  initial?: MediaSummary | null;
  kind?: MediaKindValue;
  error?: string[];
  hint?: string;
};

// Pick one media item for a form: shows a thumbnail and submits the id.
export function MediaField({ name, label, initial = null, kind = "IMAGE", error, hint }: MediaFieldProps) {
  const [media, setMedia] = useState<MediaSummary | null>(initial);
  const id = `${name}-field`;
  const message = error?.[0];

  return (
    <div className="grid gap-1.5" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
      </span>
      <input type="hidden" name={name} value={media?.id ?? ""} />
      <div className="flex items-center gap-3 rounded-lg border p-2">
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
          {media ? <MediaThumb media={media} sizes="64px" /> : <ImageIcon className="size-6 text-slate-400" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{media ? media.title || media.filename : "Nothing selected"}</p>
          <div className="mt-1.5 flex gap-2">
            <MediaPicker
              kind={kind}
              onSelect={setMedia}
              trigger={media ? "Change" : "Choose"}
              triggerLabel={`${media ? "Change" : "Choose"} ${label.toLowerCase()}`}
            />
            {media && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMedia(null)} aria-label={`Remove ${label.toLowerCase()}`}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
