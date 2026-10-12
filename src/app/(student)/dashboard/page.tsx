import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { addToCart } from "@/actions/cart";
import { CourseImage } from "@/components/site/course-card";
import { PageHeading } from "@/components/student/page-heading";
import { ProgressBar } from "@/components/student/progress-bar";
import { formatCoursePrice } from "@/lib/course";
import { cn } from "@/lib/utils";
import {
  getEnrolments,
  getLearningSummary,
  getRecentActivity,
  getStudentRecommendations,
  resumeHref,
} from "@/services/student";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "My Dashboard",
};

export default async function StudentDashboardPage() {
  const user = await requireUser();
  const enrolments = await getEnrolments(user.id);
  const [summary, recommendations, activity] = await Promise.all([
    getLearningSummary(user.id, enrolments),
    getStudentRecommendations(user.id, enrolments),
    getRecentActivity(user.id),
  ]);
  const inProgress = enrolments.filter((enrolment) => !enrolment.completed);
  const current = inProgress[0];
  const others = inProgress.slice(1, 3);
  const recentlyCompleted = enrolments.filter((enrolment) => enrolment.completed).slice(0, 3);

  const stats = [
    { label: "Enrolled", value: summary.enrolled, note: `${summary.inProgress} in progress`, className: "bg-linear-to-br from-blue-600 to-blue-900 text-white" },
    { label: "Completed", value: summary.completed, note: "Courses finished", className: "bg-linear-to-br from-orange-500 to-orange-600 text-white" },
    { label: "Certificates", value: summary.certificates, note: summary.certificates ? "Earned" : "None yet", className: "border border-gray-200 bg-white text-navy" },
    { label: "Lessons done", value: summary.lessonsCompleted, note: "Across all courses", className: "border border-gray-200 bg-white text-navy" },
  ];

  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
        description="Here's your learning snapshot."
      />

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

      {enrolments.length === 0 && (
        <section className="mb-8 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <h2 className="mb-2 text-lg font-bold text-navy">You are not enrolled in a course yet</h2>
          <p className="mb-5 text-sm text-gray-500">Pick a course from the catalogue to start learning.</p>
          <Link
            href="/courses"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Browse courses
          </Link>
        </section>
      )}

      {current && (
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">Continue learning</h2>
            <Link href="/my-courses" className="text-xs font-bold text-blue-600">
              View all →
            </Link>
          </div>
          <div className="flex flex-col gap-5 rounded-2xl bg-blue-50 p-5 sm:flex-row">
            <CourseImage
              course={current.course}
              srcWidth={400}
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
                {current.resume && (
                  <p className="mb-4 text-xs text-gray-500">
                    Next: {current.resume.title}
                  </p>
                )}
              </div>
              <div>
                <ProgressBar value={current.progress} className="mb-3" />
                <Link
                  href={resumeHref(current)}
                  className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  {current.progress === 0 ? "Start course" : "Resume lesson"}
                </Link>
              </div>
            </div>
          </div>
          {others.length > 0 && (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {others.map((enrolment) => (
                <li key={enrolment.id} className="rounded-xl border border-gray-100 p-4">
                  <p className="mb-2 line-clamp-2 text-sm font-bold text-navy">{enrolment.course.title}</p>
                  <ProgressBar value={enrolment.progress} className="mb-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{enrolment.progress}%</span>
                    <Link href={resumeHref(enrolment)} className="font-bold text-blue-600 hover:underline">
                      {enrolment.progress === 0 ? "Start" : "Resume"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {recentlyCompleted.length > 0 && (
        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-bold text-navy">Recently completed</h2>
          <ul className="space-y-2">
            {recentlyCompleted.map((enrolment) => (
              <li key={enrolment.id} className="flex items-center gap-4 rounded-xl p-3 hover:bg-gray-50">
                <CourseImage
                  course={enrolment.course}
                  srcWidth={200}
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/courses/${enrolment.course.slug}`}
                    className="line-clamp-2 text-sm font-bold text-navy hover:text-blue-600"
                  >
                    {enrolment.course.title}
                  </Link>
                  <p className="text-xs text-gray-500">
                    Completed{" "}
                    {enrolment.completedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {enrolment.certificateCode && (
                  <Link
                    href={`/certificates/${enrolment.certificateCode}`}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50"
                  >
                    Certificate
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-5 text-lg font-bold text-navy">Recommended for you</h2>
          {recommendations.length === 0 ? (
            <p className="text-sm text-gray-500">You have joined every course we have. Check back soon for new ones.</p>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((course) => (
                <li
                  key={course.slug}
                  className="flex items-center gap-4 rounded-xl p-3 hover:bg-gray-50"
                >
                  <CourseImage
                    course={course}
                    srcWidth={200}
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
                    {formatCoursePrice(course.price)}
                  </span>
                  {course.price > 0 ? (
                    <form action={addToCart}>
                      <input type="hidden" name="slug" value={course.slug} />
                      <button
                        type="submit"
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={`/courses/${course.slug}`}
                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700"
                    >
                      Join
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-bold text-navy">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">Lessons you finish will show up here.</p>
          ) : (
            <ul className="space-y-4">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                    <Check className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-navy">Completed {item.title}</p>
                    <p className="text-[10px] text-gray-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
