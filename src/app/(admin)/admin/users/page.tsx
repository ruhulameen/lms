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

export const metadata: Metadata = { title: "Users" };

const STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;

export default async function UsersPage({
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
        <Link href={`/admin/users/${u.id}`} className="font-medium text-blue-700 hover:underline">
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
        title="Users"
        description="Everyone with an account: students, instructors and staff."
        actions={
          can(viewer, "user.create") && (
            <Button render={<Link href="/admin/users/new" />}>
              <Plus aria-hidden /> New user
            </Button>
          )
        }
      />
      <DataTable
        caption="Users"
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        basePath="/admin/users"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No users found"
        emptyDescription="Try a different search or clear the filters."
        toolbar={
          <DataTableToolbar basePath="/admin/users" searchParams={params} searchPlaceholder="Search name or email">
            <FilterSelect
              name="role"
              label="All roles"
              searchParams={params}
              options={roles.map((r) => ({ value: r.name, label: r.name }))}
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
          </DataTableToolbar>
        }
      />
    </>
  );
}
