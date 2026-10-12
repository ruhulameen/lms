import Link from "next/link";
import { Ban, CircleCheck, CircleDot, RotateCcw } from "lucide-react";
import { cancelEnrolmentAction, reactivateEnrolmentAction } from "@/actions/enrolment-admin";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/activity-details";
import type { SearchParams } from "@/lib/table-params";
import type { EnrolmentRow, EnrolmentStatusValue } from "@/services/learners";

export function EnrolmentStatusBadge({ status }: { status: EnrolmentStatusValue }) {
  if (status === "COMPLETED") return <StatusBadge label="Completed" tone="success" icon={CircleCheck} />;
  if (status === "CANCELLED") return <StatusBadge label="Cancelled" tone="neutral" icon={Ban} />;
  return <StatusBadge label="In progress" tone="info" icon={CircleDot} />;
}

export function ProgressCell({ percent, done, total }: { percent: number; done?: number; total?: number }) {
  return (
    <div className="min-w-28">
      <div className="flex items-center gap-2">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Course progress"
          className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums">{percent}%</span>
      </div>
      {done !== undefined && total !== undefined && (
        <p className="mt-0.5 text-xs text-slate-500">
          {done} of {total} {total === 1 ? "lesson" : "lessons"}
        </p>
      )}
    </div>
  );
}

type EnrolmentTableProps = {
  rows: EnrolmentRow[];
  // The panel's root for links, e.g. "/admin" (an instructor panel passes "/instructor").
  basePath: string;
  // The page this table is on; sort and page links are built from it.
  tablePath: string;
  searchParams: SearchParams;
  sort: { sort: string; order: "asc" | "desc" };
  page: number;
  pageSize: number;
  total: number;
  toolbar?: React.ReactNode;
  caption: string;
  // Hide the learner column (a learner's own page) or the course column (a course's page).
  hide?: "learner" | "course";
  canManage: boolean;
  // Link learner names to their page (instructors have no learner pages).
  linkLearners?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

// Enrolments with progress, quiz results and, for people who may manage them,
// cancel and reactivate. Shared by the enrolment list, a learner's page and a
// course's learners page.
export function EnrolmentTable({
  rows,
  basePath,
  tablePath,
  searchParams,
  sort,
  page,
  pageSize,
  total,
  toolbar,
  caption,
  hide,
  canManage,
  linkLearners = true,
  emptyTitle = "No enrolments found",
  emptyDescription = "Try a different search or clear the filters.",
}: EnrolmentTableProps) {
  const allColumns: DataTableColumn<EnrolmentRow>[] = [
    {
      key: "learner",
      header: "Learner",
      sortable: true,
      cell: (e) => (
        <div className="min-w-0">
          {linkLearners ? (
            <Link href={`${basePath}/learners/${e.user.id}`} className="font-medium text-blue-700 hover:underline">
              {e.user.name}
            </Link>
          ) : (
            <span className="font-medium">{e.user.name}</span>
          )}
          <p className="truncate text-xs text-slate-500">{e.user.email}</p>
        </div>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      cell: (e) => (
        <Link href={`${basePath}/courses/${e.course.id}/learners`} className="text-blue-700 hover:underline">
          {e.course.title}
        </Link>
      ),
    },
    { key: "status", header: "Status", sortable: true, cell: (e) => <EnrolmentStatusBadge status={e.status} /> },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      cell: (e) => <ProgressCell percent={e.progressPercent} done={e.lessonsDone} total={e.lessonsTotal} />,
    },
    {
      key: "quizzes",
      header: "Quizzes",
      cell: (e) =>
        e.quizAttempts === 0 ? (
          <span className="text-slate-400">None</span>
        ) : (
          <span className="text-sm">
            {e.quizAttempts} {e.quizAttempts === 1 ? "attempt" : "attempts"}
            {e.bestQuizPercent !== null && <span className="block text-xs text-slate-500">best {e.bestQuizPercent}%</span>}
          </span>
        ),
    },
    { key: "activity", header: "Last activity", sortable: true, cell: (e) => formatDate(e.lastActivityAt) },
    {
      key: "enrolled",
      header: "Enrolled",
      sortable: true,
      cell: (e) => (
        <span>
          {formatDate(e.enrolledAt)}
          <span className="block text-xs text-slate-500">{e.source === "ADMIN" ? "Assigned" : e.source === "ORDER" ? "Order" : "Free"}</span>
        </span>
      ),
    },
    {
      key: "certificate",
      header: "Certificate",
      cell: (e) =>
        e.certificate ? (
          <Link href={`/certificates/${e.certificate.code}`} className="font-mono text-xs text-blue-700 hover:underline">
            {e.certificate.code}
            {e.certificate.revoked && <span className="ml-1 font-sans font-bold text-red-700">(revoked)</span>}
          </Link>
        ) : (
          <span className="text-slate-400">None</span>
        ),
    },
  ];
  const columns = allColumns.filter((c) => c.key !== hide);

  if (canManage) {
    columns.push({
      key: "actions",
      header: "Actions",
      cell: (e) =>
        e.status === "CANCELLED" ? (
          <ConfirmDialog
            action={reactivateEnrolmentAction}
            fields={{ enrolmentId: String(e.id) }}
            title="Reactivate this enrolment?"
            description={`${e.user.name} will get access to ${e.course.title} again, with their earlier progress.`}
            trigger={<><RotateCcw aria-hidden /> Reactivate</>}
            confirmLabel="Reactivate"
          />
        ) : (
          <ConfirmDialog
            action={cancelEnrolmentAction}
            fields={{ enrolmentId: String(e.id) }}
            title="Cancel this enrolment?"
            description={`${e.user.name} will lose access to ${e.course.title}. Their progress and any certificate are kept, and you can reactivate the enrolment later.`}
            trigger={<><Ban aria-hidden /> Cancel</>}
            triggerVariant="destructive"
            confirmLabel="Cancel enrolment"
            destructive
          />
        ),
    });
  }

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(e) => e.id}
      basePath={tablePath}
      searchParams={searchParams}
      sort={sort}
      page={page}
      pageSize={pageSize}
      total={total}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      toolbar={toolbar}
    />
  );
}
