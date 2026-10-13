import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { EnrolmentTable } from "@/components/admin/enrolment-table";
import { LearnerAccountSection } from "@/components/admin/learner-account-section";
import { LearnerCertificatesSection, LearnerQuizSection, LearnerReviewsSection } from "@/components/admin/learner-learning-sections";
import { LearnerOrdersSection, LearnerRefundsSection } from "@/components/admin/learner-money-sections";
import { LearnerSummaryTiles } from "@/components/admin/learner-summary-tiles";
import { PageHeader } from "@/components/admin/page-header";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import { describeActivity, formatDateTime } from "@/lib/activity-details";
import { parseRouteId } from "@/lib/route-id";
import { firstParam, sortParams, type SearchParams } from "@/lib/table-params";
import { listActivity } from "@/services/activity";
import { manageableCoursesWhere } from "@/services/course-access";
import {
  getLastSignIn,
  getLearnerMoney,
  getLearningSummary,
  listLearnerCertificates,
  listLearnerReviews,
} from "@/services/learner-insight";
import { ENROLMENT_SORT_KEYS, getLearnerQuizResults, listEnrolments } from "@/services/learners";
import { can, getUserDetail, listRoleOptions, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Learner" };

const BASE = "/admin";

// One learner: account, figures, courses, quizzes, certificates, orders,
// refunds, reviews and activity. Works for any account that has a profile
// here, since staff can be enrolled too.
export default async function LearnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("enrolment.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const scope = manageableCoursesWhere(viewer);
  const showMoney = can(viewer, "order.view");
  const showActivity = can(viewer, "activity.view");

  const learner = await getUserDetail(id);
  if (!learner) notFound();
  const sort = sortParams(query, ENROLMENT_SORT_KEYS, { sort: "activity", order: "desc" });
  const [roles, lastSignIn, summary, list, quizzes, certificates, reviews, money, activity] = await Promise.all([
    listRoleOptions(),
    getLastSignIn(id),
    getLearningSummary(id, scope),
    listEnrolments({ userId: id, page: 1, pageSize: 100, ...sort }, scope),
    getLearnerQuizResults(id, scope),
    listLearnerCertificates(id, scope),
    listLearnerReviews(id, scope),
    showMoney ? getLearnerMoney(id) : null,
    showActivity ? listActivity({ userId: id, pageSize: 10 }) : null,
  ]);
  const canManage = can(viewer, "enrolment.manage");

  const sections = [
    { id: "account", label: "Basic info" },
    { id: "summary", label: "Summary" },
    { id: "courses", label: "Courses" },
    { id: "quizzes", label: "Quiz results" },
    { id: "certificates", label: "Certificates" },
    ...(money ? [{ id: "orders", label: "Orders" }, { id: "refunds", label: "Refunds" }] : []),
    { id: "reviews", label: "Reviews" },
    ...(activity ? [{ id: "recent", label: "Activity" }] : []),
  ];

  return (
    <>
      <PageHeader
        title={learner.name}
        description={learner.email}
        actions={
          <>
            <UserStatusBadge status={learner.status} />
            <Button variant="outline" render={<Link href={`${BASE}/learners`} />}>
              <ChevronLeft aria-hidden /> Learners
            </Button>
            {canManage && (
              <Button render={<Link href={`${BASE}/enrolments/new?user=${learner.id}`} />}>
                <UserPlus aria-hidden /> Assign a course
              </Button>
            )}
          </>
        }
      />
      {firstParam(query.created) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Learner created. Share the initial password with them yourself.
        </p>
      )}

      <nav aria-label="On this page" className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-blue-700 hover:underline">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-8">
        <LearnerAccountSection
          user={learner}
          roles={roles}
          lastSignIn={lastSignIn}
          isSelf={viewer.id === learner.id}
          canEdit={can(viewer, "user.edit")}
          canChangeStatus={can(viewer, "user.status")}
        />

        <section aria-labelledby="summary" className="scroll-mt-4">
          <h2 id="summary" className="mb-3 text-base font-bold text-slate-900">
            Summary
          </h2>
          <LearnerSummaryTiles learning={summary} money={money?.insight} />
        </section>

        <section aria-labelledby="courses" className="scroll-mt-4">
          <h2 id="courses" className="mb-3 text-base font-bold text-slate-900">
            Courses
          </h2>
          <EnrolmentTable
            caption={`${learner.name}'s courses`}
            rows={list.rows}
            basePath={BASE}
            tablePath={`${BASE}/learners/${learner.id}`}
            searchParams={query}
            sort={sort}
            page={1}
            pageSize={100}
            total={list.total}
            hide="learner"
            canManage={canManage}
            emptyTitle="No courses yet"
            emptyDescription="This learner has not joined or been assigned a course."
          />
        </section>

        <LearnerQuizSection quizzes={quizzes} />
        <LearnerCertificatesSection certificates={certificates} />
        {money && <LearnerOrdersSection userId={learner.id} orders={money.orders} total={money.insight.orders} />}
        {money && <LearnerRefundsSection refunds={money.refunds} />}
        <LearnerReviewsSection reviews={reviews} />

        {activity && (
          <section aria-labelledby="recent" className="scroll-mt-4 rounded-xl border bg-white">
            <div className="flex items-center justify-between p-4 sm:px-6">
              <h2 id="recent" className="text-base font-bold text-slate-900">
                Recent activity
              </h2>
              <Link href={`/admin/activity-logs?q=${encodeURIComponent(learner.email)}`} className="text-sm font-medium text-blue-700 hover:underline">
                View all
              </Link>
            </div>
            {activity.rows.length === 0 ? (
              <EmptyState title="No activity yet" description="Actions this learner takes appear here." />
            ) : (
              <ul className="divide-y border-t">
                {activity.rows.map((row) => (
                  <li key={row.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:px-6">
                    <span>
                      <span className="font-medium">{row.action}</span>
                      {describeActivity(row.action, row.details) && <span className="text-slate-600"> - {describeActivity(row.action, row.details)}</span>}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
