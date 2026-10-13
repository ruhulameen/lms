import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/activity-details";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import {
  can,
  listRoleOptions,
  listUsers,
  requirePermission,
  USER_SORT_KEYS,
} from "@/services/user";

export const metadata: Metadata = { title: "Employees" };

const yesNo = (value: string | string[] | undefined) => {
  const v = firstParam(value);
  return v === "yes" || v === "no" ? v : undefined;
};

const STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermission("user.view");
  const params = await searchParams;

  const status = STATUSES.find((s) => s === firstParam(params.status));
  const sort = sortParams(params, USER_SORT_KEYS, { sort: "joined", order: "desc" });
  const [{ rows, total, page, pageSize }, roles] = await Promise.all([
    listUsers({
      search: firstParam(params.q),
      role: firstParam(params.role),
      status,
      verified: yesNo(params.verified),
      twoFactor: yesNo(params.twofa),
      excludeStudent: true,
      page: intParam(params.page),
      ...sort,
    }),
    listRoleOptions(),
  ]);

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (u) => (
        <Link href={`/admin/employees/${u.id}`} className="font-medium text-blue-700 hover:underline">
          {u.name}
        </Link>
      ),
    },
    { key: "email", header: "Email", sortable: true, cell: (u) => u.email },
    {
      key: "role",
      header: "Role",
      sortable: true,
      cell: (u) => (u.role ? <StatusBadge label={u.role.name} tone="info" /> : <span className="text-slate-400">None</span>),
    },
    { key: "status", header: "Status", sortable: true, cell: (u) => <UserStatusBadge status={u.status} /> },
    {
      key: "verified",
      header: "Email verified",
      cell: (u) => (u.emailVerified ? "Verified" : "Not verified"),
    },
    { key: "2fa", header: "2FA", cell: (u) => (u.twoFactorEnabled ? "On" : "Off") },
    { key: "joined", header: "Joined", sortable: true, cell: (u) => formatDate(u.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description="Instructors, admins and other staff. Learners have their own list."
        actions={
          can(viewer, "user.create") && (
            <Button render={<Link href="/admin/employees/new" />}>
              <Plus aria-hidden /> New employee
            </Button>
          )
        }
      />
      <DataTable
        caption="Employees"
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        basePath="/admin/employees"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No employees found"
        emptyDescription="Try a different search or clear the filters."
        toolbar={
          <DataTableToolbar basePath="/admin/employees" searchParams={params} searchPlaceholder="Search name or email">
            <FilterSelect
              name="role"
              label="All roles"
              searchParams={params}
              options={roles.filter((r) => r.name !== "student").map((r) => ({ value: r.name, label: r.name }))}
            />
            <FilterSelect
              name="status"
              label="All statuses"
              searchParams={params}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "BANNED", label: "Banned" },
              ]}
            />
            <FilterSelect
              name="verified"
              label="Email verified"
              searchParams={params}
              options={[
                { value: "yes", label: "Verified" },
                { value: "no", label: "Not verified" },
              ]}
            />
            <FilterSelect
              name="twofa"
              label="2FA"
              searchParams={params}
              options={[
                { value: "yes", label: "2FA on" },
                { value: "no", label: "2FA off" },
              ]}
            />
          </DataTableToolbar>
        }
      />
    </>
  );
}
