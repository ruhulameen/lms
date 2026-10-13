import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/activity-details";
import { formatDateInput, parseDateInput } from "@/lib/date-range";
import { money } from "@/lib/order-display";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { manageableCoursesWhere } from "@/services/course-access";
import {
  LEARNER_PROGRESS_FILTERS,
  LEARNER_SORT_KEYS,
  listCourseOptions,
  listLearners,
  type LearnerRow,
} from "@/services/learners";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Learners" };

const BASE = "/admin";
const STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
const progressLabels = { "not-started": "Not started", "in-progress": "In progress", completed: "Completed" } as const;
const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const yesNoParam = (value: string | undefined) => (value === "yes" ? true : value === "no" ? false : undefined);

export default async function LearnersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("enrolment.view");
  const params = await searchParams;
  const scope = manageableCoursesWhere(user);
  const showMoney = can(user, "order.view");
  const sort = sortParams(params, LEARNER_SORT_KEYS, { sort: "name", order: "asc" });

  const joinedFrom = parseDateInput(firstParam(params.joinedFrom));
  const joinedToDay = parseDateInput(firstParam(params.joinedTo));
  const joinedTo = joinedToDay ? new Date(joinedToDay.getFullYear(), joinedToDay.getMonth(), joinedToDay.getDate() + 1) : undefined;

  const [list, courses] = await Promise.all([
    listLearners(
      {
        search: firstParam(params.q),
        status: STATUSES.find((s) => s === firstParam(params.status)),
        courseId: intParam(params.course, 0) || undefined,
        progress: LEARNER_PROGRESS_FILTERS.find((p) => p === firstParam(params.progress)),
        hasCertificate: yesNoParam(firstParam(params.certificate)),
        hasBought: yesNoParam(firstParam(params.bought)),
        joinedFrom,
        joinedTo,
        page: intParam(params.page),
        ...sort,
      },
      scope,
      { includeMoney: showMoney },
    ),
    listCourseOptions(scope),
  ]);

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
    ...(showMoney
      ? [{ key: "spent", header: "Total spent", className: "text-right tabular-nums", cell: (l: LearnerRow) => money(l.totalSpent ?? 0) }]
      : []),
    { key: "joined", header: "Joined", sortable: true, cell: (l) => formatDate(l.joinedAt) },
    { key: "activity", header: "Last activity", cell: (l) => (l.lastActivityAt ? formatDate(l.lastActivityAt) : <span className="text-slate-400">None</span>) },
  ];

  return (
    <>
      <PageHeader
        title="Learners"
        description="Everyone with a student account, with their progress."
        actions={
          can(user, "user.create") && (
            <Button render={<Link href={`${BASE}/learners/new`} />}>
              <Plus aria-hidden /> New learner
            </Button>
          )
        }
      />
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
        emptyDescription="Try a different search or clear the filters."
        toolbar={
          <DataTableToolbar basePath={`${BASE}/learners`} searchParams={params} searchPlaceholder="Search name or email">
            <FilterSelect
              name="status"
              label="All accounts"
              searchParams={params}
              options={STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
            />
            <FilterSelect
              name="course"
              label="All courses"
              searchParams={params}
              options={courses.map((c) => ({ value: String(c.id), label: c.title }))}
            />
            <FilterSelect
              name="progress"
              label="Any progress"
              searchParams={params}
              options={LEARNER_PROGRESS_FILTERS.map((p) => ({ value: p, label: progressLabels[p] }))}
            />
            <FilterSelect name="certificate" label="Certificate: any" searchParams={params} options={yesNo} />
            <FilterSelect name="bought" label="Bought: any" searchParams={params} options={yesNo} />
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              Joined from
              <Input type="date" name="joinedFrom" defaultValue={joinedFrom ? formatDateInput(joinedFrom) : ""} className="w-36" />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              to
              <Input type="date" name="joinedTo" defaultValue={joinedToDay ? formatDateInput(joinedToDay) : ""} className="w-36" />
            </label>
          </DataTableToolbar>
        }
      />
    </>
  );
}
