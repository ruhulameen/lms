import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { formatDate } from "@/lib/activity-details";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { manageableCoursesWhere } from "@/services/course-access";
import { LEARNER_SORT_KEYS, listLearners, type LearnerRow } from "@/services/learners";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Learners" };

const BASE = "/admin";

export default async function LearnersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("enrolment.view");
  const params = await searchParams;
  const sort = sortParams(params, LEARNER_SORT_KEYS, { sort: "name", order: "asc" });
  const list = await listLearners({ search: firstParam(params.q), page: intParam(params.page), ...sort }, manageableCoursesWhere(user));

  const columns: DataTableColumn<LearnerRow>[] = [
    {
      key: "name",
      header: "Learner",
      sortable: true,
      cell: (l) => (
        <Link href={`${BASE}/learners/${l.id}`} className="font-medium text-blue-700 hover:underline">
          {l.name}
        </Link>
      ),
    },
    { key: "email", header: "Email", sortable: true, cell: (l) => l.email },
    { key: "status", header: "Account", cell: (l) => <UserStatusBadge status={l.status} /> },
    { key: "enrolments", header: "Courses", cell: (l) => l.enrolments },
    { key: "completed", header: "Completed", cell: (l) => l.completed },
    { key: "progress", header: "Average progress", cell: (l) => `${l.averageProgress}%` },
    { key: "certificates", header: "Certificates", cell: (l) => l.certificates },
    { key: "activity", header: "Last activity", cell: (l) => (l.lastActivityAt ? formatDate(l.lastActivityAt) : <span className="text-slate-400">None</span>) },
  ];

  return (
    <>
      <PageHeader title="Learners" description="Everyone who has taken part in a course, with their progress." />
      <DataTable
        caption="Learners"
        columns={columns}
        rows={list.rows}
        rowKey={(l) => l.id}
        basePath={`${BASE}/learners`}
        searchParams={params}
        sort={sort}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        emptyTitle="No learners found"
        emptyDescription="Learners appear here once they join or are assigned a course."
        toolbar={<DataTableToolbar basePath={`${BASE}/learners`} searchParams={params} searchPlaceholder="Search name or email" />}
      />
    </>
  );
}
