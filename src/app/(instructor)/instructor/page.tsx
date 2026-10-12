import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { EnrolmentStatusBadge } from "@/components/admin/enrolment-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/activity-details";
import { formatCount } from "@/lib/format";
import { getInstructorDashboard } from "@/services/instructor";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Dashboard" };

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-xl border bg-white p-4 sm:p-5 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-semibold text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export default async function InstructorDashboardPage() {
  const user = await requirePermission("course.view");
  const data = await getInstructorDashboard(user);

  const stats = [
    { label: "Courses", value: formatCount(data.totalCourses), note: `${formatCount(data.drafts)} drafts, ${formatCount(data.published)} published`, href: "/instructor/courses" },
    { label: "Pending review", value: formatCount(data.pendingReview), note: "Waiting for a publisher", href: "/instructor/courses?status=PENDING_REVIEW" },
    { label: "Learners enrolled", value: formatCount(data.learners), note: "Across your courses" },
    { label: "Completions", value: formatCount(data.completions), note: "Finished the whole course" },
    {
      label: "Average rating",
      value: data.averageRating === null ? "None yet" : data.averageRating.toFixed(1),
      note: `${formatCount(data.ratingCount)} approved ${data.ratingCount === 1 ? "review" : "reviews"}`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How your courses are doing."
        actions={
          can(user, "course.create") && (
            <Button render={<Link href="/instructor/courses/new" />}>
              <Plus aria-hidden /> New course
            </Button>
          )
        }
      />
      <Card title="Overview">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map((s) => (
            <li key={s.label}>
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className="text-2xl font-extrabold text-[#0f2a5c]">
                {s.href ? <Link href={s.href} className="hover:underline">{s.value}</Link> : s.value}
              </p>
              <p className="text-xs text-slate-500">{s.note}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Your courses">
          {data.courses.length === 0 ? (
            <EmptyState title="No courses yet" description="Create your first course to get started." />
          ) : (
            <ul className="divide-y">
              {data.courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/instructor/courses/${c.id}/edit`} className="block truncate font-medium text-blue-700 hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      <Link href={`/instructor/courses/${c.id}/learners`} className="hover:underline">
                        {formatCount(c._count.enrolments)} {c._count.enrolments === 1 ? "learner" : "learners"}
                      </Link>
                    </p>
                  </div>
                  <ContentStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent enrolments">
          {data.recentEnrolments.length === 0 ? (
            <EmptyState title="No enrolments yet" description="Learners appear here when they join one of your courses." />
          ) : (
            <ul className="divide-y">
              {data.recentEnrolments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.user.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {e.course.title} · {formatDate(e.enrolledAt)} · {e.progressPercent}%
                    </p>
                  </div>
                  <EnrolmentStatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
