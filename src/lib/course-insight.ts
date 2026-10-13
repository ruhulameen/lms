import { toPence, toPounds } from "@/lib/commerce";

// Pure arithmetic behind the admin course overview, kept apart from the
// database so it can be unit-tested.

export const progressBuckets = ["NOT_STARTED", "STARTED", "HALFWAY", "COMPLETED"] as const;
export type ProgressBucket = (typeof progressBuckets)[number];

export const progressBucketLabels: Record<ProgressBucket, string> = {
  NOT_STARTED: "Not started (0%)",
  STARTED: "1–49%",
  HALFWAY: "50–99%",
  COMPLETED: "Completed",
};

// Where a non-cancelled enrolment sits in the spread. Completed wins over the
// cached percentage.
export function progressBucket(enrolment: { status: "ACTIVE" | "COMPLETED"; progressPercent: number }): ProgressBucket {
  if (enrolment.status === "COMPLETED" || enrolment.progressPercent >= 100) return "COMPLETED";
  if (enrolment.progressPercent >= 50) return "HALFWAY";
  if (enrolment.progressPercent >= 1) return "STARTED";
  return "NOT_STARTED";
}

export function progressSpread(enrolments: { status: "ACTIVE" | "COMPLETED"; progressPercent: number }[]) {
  const counts: Record<ProgressBucket, number> = { NOT_STARTED: 0, STARTED: 0, HALFWAY: 0, COMPLETED: 0 };
  for (const e of enrolments) counts[progressBucket(e)]++;
  return progressBuckets.map((bucket) => ({
    bucket,
    count: counts[bucket],
    percent: percentOf(counts[bucket], enrolments.length),
  }));
}

// Whole percent of `part` in `whole`; 0 when there is nothing to divide by.
export const percentOf = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

// Completed over everyone not cancelled.
export const completionRate = (completed: number, nonCancelled: number) => percentOf(completed, nonCancelled);

// Mean of the cached progress percentages, whole percent.
export function averageProgress(percentages: number[]) {
  if (percentages.length === 0) return 0;
  return Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
}

// Revenue minus refunds in pence, so pounds never drift: net = gross - refunded.
export function netRevenue(grossPounds: number, refundedPounds: number) {
  return toPounds(toPence(grossPounds) - toPence(refundedPounds));
}

// "2026-10" keys for the last `count` months ending at `now`, oldest first.
export function lastMonths(now: Date, count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return monthKey(d);
  });
}

export const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
