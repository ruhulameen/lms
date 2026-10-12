import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, Check } from "lucide-react";
import { addToCart } from "@/actions/cart";
import { PageHeading, SampleNotice } from "@/components/student/page-heading";
import { ProgressBar } from "@/components/student/progress-bar";
import { formatPrice, unsplash } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getEnrolments,
  getLearningSummary,
  getRecentActivity,
  getStudentRecommendations,
} from "@/services/student";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export default async function StudentDashboardPage() {
  const [user, summary, enrolments, recommendations, activity] =
    await Promise.all([
      requireUser(),
      getLearningSummary(),
      getEnrolments(),
      getStudentRecommendations(),
      getRecentActivity(),
    ]);
  const current = enrolments.find((enrolment) => !enrolment.completed);

  const stats = [
    { label: "Enrolled", value: summary.enrolled, note: `${summary.inProgress} in progress`, className: "bg-linear-to-br from-blue-600 to-blue-900 text-white" },
    { label: "Completed", value: summary.completed, note: "Courses finished", className: "bg-linear-to-br from-orange-500 to-orange-600 text-white" },
    { label: "Certificates", value: summary.certificates, note: "Ready", className: "border border-gray-200 bg-white text-navy" },
    { label: "Learning hours", value: `${summary.learningHours}h`, note: "Last 30 days", className: "border border-gray-200 bg-white text-navy" },
  ];

  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
        description="Here's your learning snapshot."
      />
      <SampleNotice />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={cn("rounded-2xl p-5", stat.className)}>
            <p className="mb-2 text-xs font-bold tracking-wider uppercase opacity-70">
              {stat.label}
            </p>
            <p className="text-3xl font-extrabold">{stat.value}</p>
            <p className="mt-1 text-xs opacity-70">{stat.note}</p>
          </div>
        ))}
      </div>

      {current && (
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">Continue learning</h2>
            <Link href="/my-courses" className="text-xs font-bold text-blue-600">
              View all →
            </Link>
          </div>
          <div className="flex flex-col gap-5 rounded-2xl bg-blue-50 p-5 sm:flex-row">
            <Image
              src={unsplash(current.course.image, 400)}
              alt=""
              width={400}
              height={256}
              className="h-32 w-full shrink-0 rounded-xl object-cover sm:w-40"
            />
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                  {current.course.category} · {current.progress}% complete
                </p>
                <h3 className="mb-2 text-lg leading-snug font-bold text-navy">
                  {current.course.title}
                </h3>
                {current.nextLesson && (
                  <p className="mb-4 text-xs text-gray-500">
                    Next: {current.nextLesson}
                  </p>
                )}
              </div>
              <div>
                <ProgressBar value={current.progress} className="mb-3" />
                <Link
                  href={`/courses/${current.course.slug}`}
                  className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Resume lesson
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-5 text-lg font-bold text-navy">Recommended for you</h2>
          <ul className="space-y-2">
            {recommendations.map((course) => (
              <li
                key={course.slug}
                className="flex items-center gap-4 rounded-xl p-3 hover:bg-gray-50"
              >
                <Image
                  src={unsplash(course.image, 200)}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/courses/${course.slug}`}
                    className="line-clamp-2 text-sm font-bold text-navy hover:text-blue-600"
                  >
                    {course.title}
                  </Link>
                  <p className="text-xs text-gray-500">{course.category}</p>
                </div>
                <span className="font-extrabold text-navy">
                  {formatPrice(course.price)}
                </span>
                <form action={addToCart}>
                  <input type="hidden" name="slug" value={course.slug} />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    Add
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-bold text-navy">Recent activity</h2>
          <ul className="space-y-4">
            {activity.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-white",
                    item.kind === "lesson" ? "bg-green-500" : "bg-blue-600",
                  )}
                >
                  {item.kind === "lesson" ? (
                    <Check className="size-4" />
                  ) : (
                    <Award className="size-4" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-bold text-navy">{item.title}</p>
                  <p className="text-[10px] text-gray-500">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
