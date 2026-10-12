import type { Metadata } from "next";
import Link from "next/link";
import { Check, Star, Trash2, X } from "lucide-react";
import { approveReview, deleteReviewAction, rejectReview } from "@/actions/review-admin";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ListPagination } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/activity-details";
import { firstParam, intParam, listHref, type SearchParams } from "@/lib/table-params";
import { cn } from "@/lib/utils";
import { countReviewsByStatus, listReviews, type ReviewStatusValue } from "@/services/review-moderation";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Reviews" };

const BASE = "/admin/reviews";
const TABS: { value: ReviewStatusValue; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function Rating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
      ))}
    </span>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("review.moderate");
  const params = await searchParams;
  const status = TABS.find((t) => t.value === firstParam(params.status))?.value ?? "PENDING";
  const q = firstParam(params.q);
  const [counts, list] = await Promise.all([
    countReviewsByStatus(),
    listReviews({ status, search: q, page: intParam(params.page) }),
  ]);

  return (
    <>
      <PageHeader title="Reviews" description="Learner reviews are shown on the course page and the site once approved." />

      <nav aria-label="Review status" className="mb-4 flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={listHref(BASE, params, { status: tab.value === "PENDING" ? undefined : tab.value, page: undefined })}
            aria-current={tab.value === status ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab.value === status ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {tab.label} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs">{counts[tab.value]}</span>
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-xl border bg-white">
        <form method="get" action={BASE} role="search" className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:p-4">
          {status !== "PENDING" && <input type="hidden" name="status" value={status} />}
          <Input type="search" name="q" defaultValue={q} placeholder="Search review, learner or course" aria-label="Search review, learner or course" className="sm:max-w-xs" />
          <div className="flex gap-2">
            <Button type="submit">Apply</Button>
            <Button variant="ghost" render={<Link href={listHref(BASE, {}, { status: status === "PENDING" ? undefined : status })} />}>
              Reset
            </Button>
          </div>
        </form>

        {list.rows.length === 0 ? (
          <EmptyState
            title={`No ${status.toLowerCase()} reviews`}
            description={status === "PENDING" ? "New reviews waiting for a decision appear here." : "Nothing matches. Try a different search."}
          />
        ) : (
          <ul className="divide-y">
            {list.rows.map((review) => (
              <li key={review.id} className="grid gap-3 p-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Rating rating={review.rating} />
                  <span className="text-sm font-medium">{review.user.name}</span>
                  <span className="text-xs text-slate-500">{review.user.email}</span>
                  <span className="text-sm text-slate-500">on</span>
                  <Link href={`/courses/${review.course.slug}`} className="text-sm font-medium text-blue-700 hover:underline">
                    {review.course.title}
                  </Link>
                </div>
                {review.title && <p className="text-sm font-semibold">{review.title}</p>}
                {review.body ? (
                  <p className="text-sm whitespace-pre-line text-slate-700">{review.body}</p>
                ) : (
                  <p className="text-sm text-slate-400">No written review, just the rating.</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-xs text-slate-500">
                    {status === "PENDING"
                      ? `Waiting since ${formatDateTime(review.updatedAt)}`
                      : `${status === "APPROVED" ? "Approved" : "Rejected"} ${review.moderatedAt ? formatDateTime(review.moderatedAt) : ""}${review.moderatedBy ? ` by ${review.moderatedBy.name}` : ""}`}
                  </span>
                  {status !== "APPROVED" && (
                    <ConfirmDialog
                      action={approveReview}
                      fields={{ reviewId: String(review.id) }}
                      title="Approve this review?"
                      description="It will be shown on the course page and may appear in the learner reviews on the site."
                      trigger={<><Check aria-hidden /> Approve</>}
                      confirmLabel="Approve"
                    />
                  )}
                  {status !== "REJECTED" && (
                    <ConfirmDialog
                      action={rejectReview}
                      fields={{ reviewId: String(review.id) }}
                      title="Reject this review?"
                      description="It will not be shown. The learner can edit it, which sends it for approval again."
                      trigger={<><X aria-hidden /> Reject</>}
                      confirmLabel="Reject"
                    />
                  )}
                  <ConfirmDialog
                    action={deleteReviewAction}
                    fields={{ reviewId: String(review.id) }}
                    title="Delete this review?"
                    description="The review is deleted for good. The learner can write a new one."
                    trigger={<><Trash2 aria-hidden /> Delete</>}
                    triggerVariant="destructive"
                    confirmLabel="Delete review"
                    destructive
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <ListPagination basePath={BASE} searchParams={params} page={list.page} pageSize={list.pageSize} total={list.total} />
      </div>
    </>
  );
}
