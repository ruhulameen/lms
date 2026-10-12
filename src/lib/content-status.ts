import { z } from "zod";
import type { StatusTone } from "@/components/admin/status-badge";

export const contentStatuses = ["DRAFT", "PENDING_REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatusValue = (typeof contentStatuses)[number];

export const contentStatusMeta: Record<ContentStatusValue, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_REVIEW: { label: "Pending review", tone: "warning" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

// Live on the public site right now. Scheduled content needs no cron job: it
// counts as published once its time has passed.
export function isPublic(status: ContentStatusValue, publishAt: Date | null | undefined, now = new Date()) {
  if (status === "PUBLISHED") return true;
  return status === "SCHEDULED" && Boolean(publishAt) && publishAt!.getTime() <= now.getTime();
}

// Prisma `where` fragment for public queries: spread it into the page/post filter.
export function publiclyVisibleWhere(now = new Date()) {
  return {
    OR: [
      { status: "PUBLISHED" as const },
      { status: "SCHEDULED" as const, publishAt: { lte: now } },
    ],
  };
}

// Statuses the user may move an item to. Publishers can set any status.
// Editors without publish rights can only save a draft or submit for review,
// and cannot change content that is already live, scheduled or archived.
export function allowedTransitions(
  current: ContentStatusValue | null,
  perms: { canEdit: boolean; canPublish: boolean },
): ContentStatusValue[] {
  if (perms.canPublish) return [...contentStatuses];
  if (!perms.canEdit) return [];
  if (current === null || current === "DRAFT" || current === "PENDING_REVIEW") {
    return ["DRAFT", "PENDING_REVIEW"];
  }
  return [];
}

export function canTransition(
  current: ContentStatusValue | null,
  target: ContentStatusValue,
  perms: { canEdit: boolean; canPublish: boolean },
) {
  return allowedTransitions(current, perms).includes(target);
}

// "2026-10-12T14:30" from a datetime-local input plus the browser's
// Date#getTimezoneOffset() (minutes, UTC minus local) gives the UTC instant.
export function parseSchedule(value: string, timezoneOffsetMinutes: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match || !Number.isFinite(timezoneOffsetMinutes) || Math.abs(timezoneOffsetMinutes) > 14 * 60) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // Rejects rolled-over dates such as 31 February.
  if (utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return new Date(utc.getTime() + timezoneOffsetMinutes * 60_000);
}

// Inverse of parseSchedule, to fill a datetime-local input in the browser's zone.
export function toDatetimeLocalValue(date: Date, timezoneOffsetMinutes: number) {
  return new Date(date.getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 16);
}

// Column values for a save with the chosen status. publishedAt is set the first
// time content goes live and never cleared.
export function statusFields(
  status: ContentStatusValue,
  options: { publishAt?: Date | null; publishedAt?: Date | null; now?: Date },
) {
  const now = options.now ?? new Date();
  return {
    status,
    publishAt: status === "SCHEDULED" ? (options.publishAt ?? null) : null,
    publishedAt:
      options.publishedAt ?? (status === "PUBLISHED" ? now : null),
  };
}

// Fields <PublishControls> submits. `publishAt` is the UTC instant, set only
// when the status is SCHEDULED. Callers still check the status against
// allowedTransitions() for the signed-in user.
export const publishFieldsSchema = z
  .object({
    status: z.enum(contentStatuses),
    publishAtLocal: z.string().optional(),
    timezoneOffset: z.coerce.number().optional(),
  })
  .transform((value, ctx) => {
    if (value.status !== "SCHEDULED") return { status: value.status, publishAt: null as Date | null };
    const publishAt = parseSchedule(value.publishAtLocal ?? "", value.timezoneOffset ?? 0);
    if (!publishAt) {
      ctx.addIssue({ code: "custom", path: ["publishAtLocal"], message: "Choose a valid date and time." });
      return z.NEVER;
    }
    return { status: value.status, publishAt };
  });
