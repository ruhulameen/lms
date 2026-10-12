"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Folder, Users } from "lucide-react";
import { SectionBadge } from "@/components/site/section-badge";
import { UserAvatar } from "@/components/site/user-avatar";
import { courseImageSrc, formatCoursePrice } from "@/lib/course";
import { formatCount } from "@/lib/format";
import type { CourseReview } from "@/services/review";

const arrowClassName =
  "flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-blue-600 hover:text-white";

function Reviewer({ review }: { review: CourseReview }) {
  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={review.name} image={review.avatar} className="size-11" />
      <div>
        <p className="text-sm font-bold text-navy">{review.name}</p>
        <p className="mt-0.5 text-xs text-amber-500" aria-label={`Rated ${review.rating} out of 5`}>
          {"★".repeat(review.rating)}
          <span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
        </p>
      </div>
    </div>
  );
}

export function ReviewSlider({ reviews }: { reviews: CourseReview[] }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (amount: number) =>
    track.current?.scrollBy({ left: amount, behavior: "smooth" });

  return (
    <>
      <div className="mb-10 flex flex-col justify-between sm:flex-row sm:items-end">
        <div>
          <SectionBadge className="mb-3">Student Feedback</SectionBadge>
          <h2 className="text-3xl font-extrabold text-navy">
            Hear From Our Learners
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Hover or focus a review to see the course they took.
          </p>
        </div>
        <div className="mt-4 flex gap-3 sm:mt-0">
          <button
            type="button"
            aria-label="Previous reviews"
            onClick={() => scroll(-360)}
            className={arrowClassName}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="More reviews"
            onClick={() => scroll(360)}
            className={arrowClassName}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={track}
        className="flex snap-x gap-6 overflow-x-auto pt-2 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <div
            key={review.id}
            className="group relative min-h-80 w-[85vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-[0.875rem] border border-slate-200 bg-white shadow-[0_4px_15px_rgba(0,0,0,0.05)] transition duration-300 focus-within:shadow-[0_15px_35px_rgba(0,0,0,0.12)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.12)]"
          >
            <div className="flex h-full flex-col p-6 transition-opacity duration-300 group-focus-within:opacity-0 group-hover:opacity-0">
              <p className="mb-3 font-serif text-3xl leading-none text-blue-600">
                “
              </p>
              <p className="mb-5 text-sm leading-relaxed text-gray-600">
                {review.quote}
              </p>
              <div className="mt-auto border-t border-gray-100 pt-4">
                <Reviewer review={review} />
              </div>
            </div>

            <div className="absolute inset-0 flex flex-col bg-white p-6 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100">
              <Reviewer review={review} />
              <div className="my-4 border-t border-gray-100" />
              <div className="mb-3 flex gap-3">
                {courseImageSrc(review.course, 200) ? (
                  <Image
                    src={courseImageSrc(review.course, 200)!}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="size-14 shrink-0 rounded-lg bg-linear-to-br from-blue-100 to-sky-200" />
                )}
                <p className="text-sm leading-snug font-semibold text-blue-600">
                  {review.course.title}
                </p>
              </div>
              <p className="mb-3 text-2xl font-extrabold text-navy">
                {formatCoursePrice(review.course.price)}
              </p>
              <div className="mb-4 space-y-2 text-xs text-gray-600">
                <p className="flex items-center gap-2.5">
                  <Folder className="size-4 shrink-0 text-blue-600" />
                  Category: {review.course.category}
                </p>
                {review.course.students > 0 && (
                  <p className="flex items-center gap-2.5">
                    <Users className="size-4 shrink-0 text-blue-600" />
                    Students enrolled: {formatCount(review.course.students)}
                  </p>
                )}
              </div>
              <Link
                href={`/courses/${review.course.slug}`}
                className="mt-auto rounded-lg bg-blue-600 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
