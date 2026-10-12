"use client";

import { useState } from "react";
import { selectClassName } from "@/components/admin/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  allowedTransitions,
  contentStatusMeta,
  toDatetimeLocalValue,
  type ContentStatusValue,
} from "@/lib/content-status";

type PublishControlsProps = {
  // Saved status; null for a new item.
  current: ContentStatusValue | null;
  canEdit: boolean;
  canPublish: boolean;
  // Saved schedule, as an ISO string.
  publishAt?: string | null;
  // fieldErrors from the action result.
  errors?: Record<string, string[] | undefined>;
};

// Submits `status`, `publishAtLocal` and `timezoneOffset`; parse them on the
// server with publishFieldsSchema and re-check the status with allowedTransitions.
export function PublishControls({ current, canEdit, canPublish, publishAt, errors }: PublishControlsProps) {
  const options = allowedTransitions(current, { canEdit, canPublish });
  const [status, setStatus] = useState<ContentStatusValue>(
    current && options.includes(current) ? current : (options[0] ?? "DRAFT"),
  );

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        You can view this item but not change its status. Ask someone with publish permission.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="content-status">Status</Label>
        <select
          id="content-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ContentStatusValue)}
          className={selectClassName}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {contentStatusMeta[value].label}
            </option>
          ))}
        </select>
        {!canPublish && (
          <p className="text-xs text-slate-500">You can save a draft or submit it for review.</p>
        )}
      </div>

      {status === "SCHEDULED" && (
        <div className="grid gap-1.5">
          <Label htmlFor="content-publish-at">Publish at</Label>
          <Input
            id="content-publish-at"
            name="publishAtLocal"
            type="datetime-local"
            required
            aria-invalid={Boolean(errors?.publishAtLocal)}
            aria-describedby={errors?.publishAtLocal ? "content-publish-at-error" : undefined}
            // Filled from the saved UTC time in the browser's own time zone.
            ref={(el) => {
              if (el && !el.value && publishAt) {
                el.value = toDatetimeLocalValue(new Date(publishAt), new Date().getTimezoneOffset());
              }
            }}
          />
          {errors?.publishAtLocal && (
            <p id="content-publish-at-error" role="alert" className="text-sm text-destructive">
              {errors.publishAtLocal[0]}
            </p>
          )}
          <p className="text-xs text-slate-500">In your local time zone.</p>
        </div>
      )}
      <input
        type="hidden"
        name="timezoneOffset"
        ref={(el) => {
          if (el) el.value = String(new Date().getTimezoneOffset());
        }}
      />
    </div>
  );
}
