import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { TimeChart } from "@/components/admin/charts";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { CourseSubnav } from "@/components/admin/course-subnav";
import { EmptyState } from "@/components/admin/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/activity-details";
import { courseLevelLabels, formatCoursePrice, lessonTypeLabels } from "@/lib/course";
import { progressBucketLabels } from "@/lib/course-insight";
import { isPublic } from "@/lib/content-status";
import { formatCount } from "@/lib/format";
import { money } from "@/lib/order-display";
import { parseRouteId } from "@/lib/route-id";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseFacts, getCourseLearnerInsight, getCourseMoneyInsight } from "@/services/course-insight";
import { can } from "@/services/user";

export const metadata: Metadata = { title: "Course overview" };

const sourceLabels = { FREE: "Free", ADMIN: "Assigned", ORDER: "Bought" } as const;

function Section({ title, children, className, bare }: { title: string; children: React.ReactNode; className?: string; bare?: boolean }) {
  return (
    <section aria-label={title} className={`rounded-xl border bg-white p-4 sm:p-5 ${className ?? ""}`}>
      {!bare && <h2 className="mb-3 text-sm font-semibold text-slate-500">{title}</h2>}
      {children}
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <li>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-[#0f2a5c]">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </li>
  );
}

function RecentHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
      <Link href={href} className="text-sm font-medium text-blue-700 hover:underline">{linkLabel}</Link>
    </div>
  );
}

export default async function CourseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const { user: viewer } = await assertCourseAccess(id, "course.view");
  const showLearners = can(viewer, "enrolment.view");
  const showMoney = can(viewer, "order.view");

  const [course, learners, sales] = await Promise.all([
    getCourseFacts(id),
    showLearners ? getCourseLearnerInsight(id) : null,
    showMoney ? getCourseMoneyInsight(id) : null,
  ]);
  if (!course) notFound();
  const published = course.publishedAt ?? (isPublic(course.status, course.publishAt) ? course.publishAt : null);

  const facts: [string, React.ReactNode][] = [
    ["Instructor", course.instructor?.name ?? "None"],
    ["Category", course.category?.name ?? "None"],
    ["Level", courseLevelLabels[course.level]],
    ["Price", formatCoursePrice(course.price)],
    ["Published", published ? formatDate(published) : "Not yet"],
    ["Curriculum", `${course.moduleCount} module${course.moduleCount === 1 ? "" : "s"}, ${course.lessonCount} published lesson${course.lessonCount === 1 ? "" : "s"}`],
  ];

  return (
    <>
      <PageHeader
        title={course.title}
        description={`/courses/${course.slug}`}
        actions={
          <>
            <ContentStatusBadge status={course.status} className="self-center" />
            {isPublic(course.status, course.publishAt) && (
              <Button variant="outline" render={<Link href={`/courses/${course.slug}`} target="_blank" />}>
                <ExternalLink aria-hidden /> View live
              </Button>
            )}
          </>
        }
      />
      <CourseSubnav courseId={id} basePath="/admin/courses" active="overview" />

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-white p-4 text-sm sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {!learners && !sales && (
        <Section title="Figures">
          <p className="text-sm text-slate-600">You do not have permission to see learner or sales figures for this course.</p>
        </Section>
      )}

      {(learners || sales) && (
        <Section title="At a glance">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
            {learners && (
              <>
                <Tile label="Enrolled" value={formatCount(learners.enrolled)} note="Everyone not cancelled" />
                <Tile label="In progress" value={formatCount(learners.inProgress)} />
                <Tile label="Completed" value={formatCount(learners.completed)} />
                <Tile label="Completion rate" value={`${learners.completionRate}%`} />
                <Tile label="Average progress" value={`${learners.averageProgress}%`} />
                <Tile label="Cancelled" value={formatCount(learners.cancelled)} />
                <Tile label="Certificates issued" value={formatCount(learners.certificates)} note="Not revoked" />
                <Tile
                  label="Rating"
                  value={learners.rating === null ? "No ratings" : `${learners.rating} / 5`}
                  note={`${formatCount(learners.reviewCount)} approved review${learners.reviewCount === 1 ? "" : "s"}`}
                />
              </>
            )}
            {sales && (
              <>
                <Tile label="Revenue" value={money(sales.revenue)} note="Paid order lines" />
                <Tile label="Refunded" value={money(sales.refunded)} />
                <Tile label="Net revenue" value={money(sales.net)} note="Revenue minus refunded" />
              </>
            )}
          </ul>
        </Section>
      )}

      {learners && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Section title="Enrolments by source">
              <ul className="flex flex-wrap gap-x-8 gap-y-3">
                {(Object.keys(sourceLabels) as (keyof typeof sourceLabels)[]).map((key) => (
                  <li key={key}>
                    <p className="text-xs font-medium text-slate-500">{sourceLabels[key]}</p>
                    <p className="text-2xl font-extrabold text-[#0f2a5c]">{formatCount(learners.bySource[key])}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 mb-2 text-xs font-medium text-slate-500">Enrolments per month (last 12 months)</p>
              {learners.enrolled === 0 ? (
                <EmptyState title="No enrolments yet" />
              ) : (
                <TimeChart points={learners.perMonth.map((m) => ({ label: m.date, value: m.count }))} name="Enrolments" type="column" height={220} />
              )}
            </Section>

            <Section title="Progress spread">
              {learners.enrolled === 0 ? (
                <EmptyState title="No learners yet" />
              ) : (
                <ul className="space-y-3">
                  {learners.spread.map((s) => (
                    <li key={s.bucket}>
                      <div className="flex justify-between text-sm">
                        <span>{progressBucketLabels[s.bucket]}</span>
                        <span className="font-medium">{formatCount(s.count)} ({s.percent}%)</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${s.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Lesson by lesson" className="mt-6">
            <p className="mb-3 text-xs text-slate-500">
              Learners (not cancelled) who finished each published lesson, as a share of {formatCount(learners.enrolled)}. A sharp fall shows where people stop.
            </p>
            {learners.modules.length === 0 ? (
              <EmptyState title="No published lessons" />
            ) : (
              <div className="space-y-5">
                {learners.modules.map((m) => (
                  <div key={m.id}>
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">{m.title}</h3>
                    <ul className="divide-y">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                          <span className="min-w-0 truncate">
                            {l.title} <span className="text-xs text-slate-500">{lessonTypeLabels[l.type as keyof typeof lessonTypeLabels]}</span>
                          </span>
                          <div className="order-last col-span-2 h-2 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1" role="presentation">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${l.percent}%` }} />
                          </div>
                          <span className="text-right font-medium tabular-nums">{formatCount(l.done)} ({l.percent}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Quizzes" className="mt-6">
            {learners.quizzes.length === 0 ? (
              <EmptyState title="No quizzes in this course" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-medium">Quiz</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Learners</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Attempts</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Pass rate</th>
                      <th scope="col" className="py-2 pl-4 text-right font-medium">Average score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {learners.quizzes.map((q) => (
                      <tr key={q.lessonId}>
                        <td className="py-2 pr-4">{q.title}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatCount(q.learners)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatCount(q.attempts)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{q.attempts === 0 ? "-" : `${q.passRate}%`}</td>
                        <td className="py-2 pl-4 text-right tabular-nums">{q.averageScore === null ? "-" : `${q.averageScore}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {(learners || sales) && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          {learners && (
            <Section title="Recent enrolments" bare>
              <RecentHeader title="Recent enrolments" href={`/admin/courses/${id}/learners`} linkLabel="All learners" />
              {learners.recentEnrolments.length === 0 ? (
                <p className="text-sm text-slate-500">No enrolments yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {learners.recentEnrolments.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link href={`/admin/learners/${e.user.id}`} className="block truncate font-medium text-blue-700 hover:underline">{e.user.name}</Link>
                        <span className="text-xs text-slate-500">{sourceLabels[e.source]}, {formatDate(e.enrolledAt)}, {e.progressPercent}%</span>
                      </span>
                      <StatusBadge
                        label={e.status === "ACTIVE" ? "Active" : e.status === "COMPLETED" ? "Completed" : "Cancelled"}
                        tone={e.status === "ACTIVE" ? "info" : e.status === "COMPLETED" ? "success" : "neutral"}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          {learners && can(viewer, "certificate.view") && (
            <Section title="Recent certificates" bare>
              <RecentHeader title="Recent certificates" href={`/admin/certificates?course=${course.id}`} linkLabel="All certificates" />
              {learners.recentCertificates.length === 0 ? (
                <p className="text-sm text-slate-500">No certificates yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {learners.recentCertificates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link href={`/admin/learners/${c.userId}`} className="block truncate font-medium text-blue-700 hover:underline">{c.learnerName}</Link>
                        <span className="text-xs text-slate-500">{c.code}, {formatDate(c.issuedAt)}</span>
                      </span>
                      {c.revokedAt && <StatusBadge label="Revoked" tone="danger" />}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          {sales && (
            <Section title="Recent orders" bare>
              <RecentHeader title="Recent orders" href="/admin/orders" linkLabel="All orders" />
              {sales.recentOrders.length === 0 ? (
                <p className="text-sm text-slate-500">No orders include this course yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {sales.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link href={`/admin/orders/${o.id}`} className="block truncate font-medium text-blue-700 hover:underline">{o.orderNumber}</Link>
                        <span className="text-xs text-slate-500">{o.learner}, {formatDate(o.createdAt)}, {money(o.lineTotal)}</span>
                      </span>
                      <OrderStatusBadge status={o.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      )}
    </>
  );
}
