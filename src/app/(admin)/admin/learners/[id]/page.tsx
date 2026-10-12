import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UserPlus } from "lucide-react";
import { EnrolmentTable } from "@/components/admin/enrolment-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/activity-details";
import { parseRouteId } from "@/lib/route-id";
import { sortParams, type SearchParams } from "@/lib/table-params";
import { manageableCoursesWhere } from "@/services/course-access";
import { ENROLMENT_SORT_KEYS, getLearnerQuizResults, getUserBrief, listEnrolments } from "@/services/learners";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Learner progress" };

const BASE = "/admin";

// One learner: every course they have, with progress, quiz results and certificates.
export default async function LearnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("enrolment.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const scope = manageableCoursesWhere(viewer);

  const learner = await getUserBrief(id);
  if (!learner) notFound();
  const sort = sortParams(query, ENROLMENT_SORT_KEYS, { sort: "activity", order: "desc" });
  const [list, quizzes] = await Promise.all([
    listEnrolments({ userId: id, page: 1, pageSize: 100, ...sort }, scope),
    getLearnerQuizResults(id, scope),
  ]);
  const canManage = can(viewer, "enrolment.manage");

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
            {can(viewer, "user.view") && (
              <Button variant="outline" render={<Link href={`${BASE}/users/${learner.id}`} />}>
                User account
              </Button>
            )}
            {canManage && (
              <Button render={<Link href={`${BASE}/enrolments/new?user=${learner.id}`} />}>
                <UserPlus aria-hidden /> Assign a course
              </Button>
            )}
          </>
        }
      />

      <section aria-labelledby="courses" className="mb-8">
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

      <section aria-labelledby="quizzes">
        <h2 id="quizzes" className="mb-3 text-base font-bold text-slate-900">
          Quiz results
        </h2>
        {quizzes.length === 0 ? (
          <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">No quiz attempts yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <ul className="divide-y">
              {quizzes.map((quiz) => (
                <li key={quiz.lessonId} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{quiz.lessonTitle}</span>
                    <span className="block text-xs text-slate-500">{quiz.courseTitle}</span>
                  </span>
                  <span>
                    {quiz.attempts} {quiz.attempts === 1 ? "attempt" : "attempts"}
                  </span>
                  <span>Best {quiz.bestPercent ?? 0}%</span>
                  {quiz.lastAttemptAt && <span className="text-slate-500">Last {formatDate(quiz.lastAttemptAt)}</span>}
                  <StatusBadge label={quiz.passed ? "Passed" : "Not passed"} tone={quiz.passed ? "success" : "warning"} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
