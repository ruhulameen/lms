"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitCourseReview } from "@/actions/course-review";
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from "@/lib/course";
import { initialFormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

type Review = {
  rating: number;
  title: string | null;
  body: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

const statusNote: Record<Review["status"], { label: string; className: string }> = {
  PENDING: { label: "Awaiting approval", className: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Published", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Not approved", className: "bg-red-100 text-red-700" },
};

const fieldClassName =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10";

// The enrolled learner's own review: stars (arrow keys move between them),
// a title and the text. One per course; saving again edits it.
export function CourseReviewForm({ slug, review }: { slug: string; review: Review | null }) {
  const [state, formAction, pending] = useActionState(submitCourseReview, initialFormState);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  const note = review ? statusNote[review.status] : null;

  return (
    <form action={formAction} className="rounded-xl border border-gray-200 bg-white p-5">
      <input type="hidden" name="slug" value={slug} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-navy">{review ? "Your review" : "Review this course"}</h3>
        {note && <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", note.className)}>{note.label}</span>}
      </div>
      {review?.status === "PENDING" && (
        <p className="mb-4 text-xs text-gray-500">Your review is awaiting approval. It will show on this page once approved.</p>
      )}
      {review?.status === "APPROVED" && (
        <p className="mb-4 text-xs text-gray-500">Your review is shown on this page. Editing it sends it back for approval.</p>
      )}

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold tracking-wider text-gray-500 uppercase">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className="cursor-pointer rounded p-0.5 has-focus-visible:ring-3 has-focus-visible:ring-blue-600/40"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
                aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              />
              <Star
                aria-hidden
                className={cn("size-8 transition", n <= shown ? "fill-amber-400 text-amber-400" : "text-gray-300")}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-4">
        <label htmlFor="review-title" className="mb-2 block text-xs font-bold tracking-wider text-gray-500 uppercase">
          Title (optional)
        </label>
        <input
          id="review-title"
          name="title"
          maxLength={REVIEW_TITLE_MAX}
          defaultValue={state.values?.title ?? review?.title ?? ""}
          className={fieldClassName}
        />
      </div>
      <div className="mb-4">
        <label htmlFor="review-body" className="mb-2 block text-xs font-bold tracking-wider text-gray-500 uppercase">
          Your review (optional)
        </label>
        <textarea
          id="review-body"
          name="body"
          rows={4}
          maxLength={REVIEW_BODY_MAX}
          defaultValue={state.values?.body ?? review?.body ?? ""}
          className={fieldClassName}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:opacity-60"
        >
          {pending ? "Saving…" : review ? "Update review" : "Submit review"}
        </button>
        {!state.ok && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p role="status" className="text-sm text-green-700">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
