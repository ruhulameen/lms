import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageHeading, SampleNotice } from "@/components/student/page-heading";
import { ProgressBar } from "@/components/student/progress-bar";
import { categoryStyle } from "@/lib/category";
import { unsplash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEnrolments, getLearningSummary } from "@/services/student";

export const metadata: Metadata = {
  title: "My Courses",
};

export default async function MyCoursesPage() {
  const [enrolments, summary] = await Promise.all([
    getEnrolments(),
    getLearningSummary(),
  ]);

  return (
    <>
      <PageHeading
        title="My Courses"
        description={`${summary.enrolled} enrolled · ${summary.inProgress} in progress · ${summary.completed} completed`}
      >
        <Link
          href="/courses"
          className="self-start rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          + Browse more
        </Link>
      </PageHeading>
      <SampleNotice />

      <div className="grid gap-5 sm:grid-cols-2">
        {enrolments.map((enrolment) => (
          <div
            key={enrolment.course.slug}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-lg"
          >
            <div className="relative h-40">
              <Image
                src={unsplash(enrolment.course.image, 500)}
                alt=""
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
              <span
                className={cn(
                  "absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase",
                  enrolment.completed
                    ? "bg-green-100 text-green-600"
                    : "bg-orange-100 text-orange-600",
                )}
              >
                {enrolment.completed ? "Completed" : "In progress"}
              </span>
            </div>
            <div className="flex grow flex-col p-5">
              <p
                className={cn(
                  "mb-1 text-[10px] font-bold tracking-wider uppercase",
                  categoryStyle(enrolment.course.category).text,
                )}
              >
                {enrolment.course.category}
              </p>
              <h2 className="mb-4 grow text-base leading-snug font-bold text-navy">
                {enrolment.course.title}
              </h2>
              {enrolment.completed ? (
                <p className="mb-4 flex items-center gap-2 text-sm text-green-600">
                  <Check className="size-4" /> Certificate earned
                </p>
              ) : (
                <>
                  <ProgressBar value={enrolment.progress} className="mb-2" />
                  <p className="mb-4 text-xs text-gray-500">
                    {enrolment.progress}% · Next: {enrolment.nextLesson}
                  </p>
                </>
              )}
              <Link
                href={
                  enrolment.completed
                    ? "/my-certificates"
                    : `/courses/${enrolment.course.slug}`
                }
                className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-bold text-white transition hover:bg-blue-700"
              >
                {enrolment.completed ? "View certificate" : "Resume"}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
