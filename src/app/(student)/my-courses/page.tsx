import type { Metadata } from "next";
import Link from "next/link";
import { Award, Check } from "lucide-react";
import { CourseImage } from "@/components/site/course-card";
import { PageHeading } from "@/components/student/page-heading";
import { ProgressBar } from "@/components/student/progress-bar";
import { categoryStyle } from "@/lib/category";
import { cn } from "@/lib/utils";
import { getEnrolments, getLearningSummary, resumeHref } from "@/services/student";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "My Courses",
};

const filters = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const;

type Filter = (typeof filters)[number]["value"];

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = filters.some((f) => f.value === rawFilter) ? (rawFilter as Filter) : "all";
  const user = await requireUser();
  const all = await getEnrolments(user.id);
  const summary = await getLearningSummary(user.id, all);
  const enrolments = all.filter((e) =>
    filter === "all" ? true : filter === "completed" ? e.completed : !e.completed,
  );

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

      <nav aria-label="Filter courses" className="mb-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <Link
            key={item.value}
            href={item.value === "all" ? "/my-courses" : `/my-courses?filter=${item.value}`}
            aria-current={filter === item.value ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              filter === item.value
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-slate-600 hover:text-blue-600",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {enrolments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <h2 className="mb-2 text-lg font-bold text-navy">
            {all.length === 0
              ? "You have not enrolled in any courses yet"
              : filter === "completed"
                ? "No completed courses yet"
                : "Nothing in progress"}
          </h2>
          <p className="mb-5 text-sm text-gray-500">
            {all.length === 0
              ? "Browse the catalogue and join a free course to get started."
              : "Courses you finish will be listed here."}
          </p>
          <Link
            href="/courses"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {enrolments.map((enrolment) => (
            <div
              key={enrolment.id}
              className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-lg"
            >
              <div className="relative h-40">
                <CourseImage
                  course={enrolment.course}
                  srcWidth={500}
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
                  <Link href={`/courses/${enrolment.course.slug}`} className="hover:text-blue-600">
                    {enrolment.course.title}
                  </Link>
                </h2>
                <ProgressBar value={enrolment.progress} className="mb-2" />
                <p className="mb-4 text-xs text-gray-500">
                  {enrolment.completed ? (
                    <span className="flex items-center gap-1.5 text-green-600">
                      <Check className="size-3.5" /> Course completed
                    </span>
                  ) : (
                    <>
                      {enrolment.progress}%
                      {enrolment.resume && ` · Next: ${enrolment.resume.title}`}
                    </>
                  )}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={resumeHref(enrolment)}
                    className="block flex-1 rounded-lg bg-blue-600 py-2.5 text-center text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    {enrolment.completed ? "Review" : enrolment.progress === 0 ? "Start" : "Continue"}
                  </Link>
                  {enrolment.certificateCode && (
                    <Link
                      href={`/certificates/${enrolment.certificateCode}`}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-4 text-sm font-bold text-blue-600 transition hover:bg-blue-50"
                    >
                      <Award className="size-4" /> Certificate
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
