import type { Metadata } from "next";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import { describeActivity, formatDateTime } from "@/lib/activity-details";
import { parseDateInput } from "@/lib/date-range";
import { firstParam, intParam, type SearchParams } from "@/lib/table-params";
import { listActivity, listActivityFilterOptions } from "@/services/activity";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Activity logs" };

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission("activity.view");
  const params = await searchParams;

  const fromValue = firstParam(params.from);
  const toValue = firstParam(params.to);
  const [{ rows, total, page, pageSize }, options] = await Promise.all([
    listActivity({
      search: firstParam(params.q),
      action: firstParam(params.action),
      entity: firstParam(params.entity),
      from: parseDateInput(fromValue),
      to: parseDateInput(toValue),
      page: intParam(params.page),
    }),
    listActivityFilterOptions(),
  ]);

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: "time", header: "Time", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span> },
    {
      key: "user",
      header: "User",
      cell: (r) =>
        r.user ? (
          <>
            <span className="block font-medium">{r.user.name}</span>
            <span className="block text-xs text-slate-500">{r.user.email}</span>
          </>
        ) : (
          <span className="text-slate-500">System or deleted user</span>
        ),
    },
    { key: "action", header: "Action", cell: (r) => <code className="text-xs">{r.action}</code> },
    {
      key: "entity",
      header: "Entity",
      cell: (r) => (r.entityId ? `${r.entity} #${r.entityId}` : r.entity),
    },
    { key: "ip", header: "IP", cell: (r) => r.ipAddress ?? "-" },
    {
      key: "details",
      header: "Details",
      className: "max-w-sm whitespace-normal",
      cell: (r) => describeActivity(r.action, r.details) || "-",
    },
  ];

  return (
    <>
      <PageHeader title="Activity logs" description="Who did what, newest first." />
      <DataTable
        caption="Activity logs"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        basePath="/admin/activity-logs"
        searchParams={params}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No activity found"
        emptyDescription="Nothing matches these filters yet."
        toolbar={
          <DataTableToolbar basePath="/admin/activity-logs" searchParams={params} searchPlaceholder="Search activity">
            <FilterSelect
              name="action"
              label="All actions"
              searchParams={params}
              options={options.actions.map((a) => ({ value: a, label: a }))}
            />
            <FilterSelect
              name="entity"
              label="All entities"
              searchParams={params}
              options={options.entities.map((e) => ({ value: e, label: e }))}
            />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              From
              <Input type="date" name="from" defaultValue={parseDateInput(fromValue) ? fromValue : ""} className="w-38" />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              To
              <Input type="date" name="to" defaultValue={parseDateInput(toValue) ? toValue : ""} className="w-38" />
            </label>
          </DataTableToolbar>
        }
      />
    </>
  );
}
