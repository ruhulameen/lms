import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRole } from "@/actions/role";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { listRoles, ROLE_SORT_KEYS } from "@/services/role";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("role.view");
  const canManage = can(viewer, "role.manage");
  const params = await searchParams;

  const sort = sortParams(params, ROLE_SORT_KEYS, { sort: "name", order: "asc" });
  const { rows, total, page, pageSize } = await listRoles({
    search: firstParam(params.q),
    page: intParam(params.page),
    ...sort,
  });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "Role",
      sortable: true,
      cell: (r) => (
        <>
          <Link href={`/admin/roles/${r.id}`} className="font-medium text-blue-700 hover:underline">
            {r.name}
          </Link>
          {r.system && <StatusBadge label="System" tone="neutral" className="ml-2" />}
        </>
      ),
    },
    { key: "description", header: "Description", className: "whitespace-normal text-slate-600", cell: (r) => r.description ?? "-" },
    { key: "people", header: "People", sortable: true, className: "text-right", cell: (r) => r.userCount },
    {
      key: "permissions",
      header: "Permissions",
      sortable: true,
      className: "text-right",
      cell: (r) => (r.name === "admin" ? "All" : r.permissionCount),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/admin/roles/${r.id}`} aria-label={`View role ${r.name}`} />}>
            <Eye aria-hidden /> View
          </Button>
          {canManage && !r.system && (
            <>
              <Button variant="outline" size="sm" render={<Link href={`/admin/roles/${r.id}/edit`} aria-label={`Edit role ${r.name}`} />}>
                <Pencil aria-hidden /> Edit
              </Button>
              <ConfirmDialog
                action={deleteRole}
                fields={{ id: String(r.id) }}
                title={`Delete role "${r.name}"?`}
                description={
                  r.userCount > 0
                    ? `${r.userCount} ${r.userCount === 1 ? "person still has" : "people still have"} this role, so it cannot be deleted yet.`
                    : "This removes the role and its permissions. It cannot be undone."
                }
                trigger={<><Trash2 aria-hidden /> Delete</>}
                triggerLabel={`Delete role ${r.name}`}
                triggerVariant="destructive"
                confirmLabel="Delete role"
                destructive
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles"
        description="Roles decide what each person can do. Student, instructor and admin are system roles and cannot be changed."
        actions={
          canManage && (
            <Button render={<Link href="/admin/roles/new" />}>
              <Plus aria-hidden /> New role
            </Button>
          )
        }
      />
      <DataTable
        caption="Roles"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        basePath="/admin/roles"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No roles found"
        emptyDescription="Try a different search."
        toolbar={<DataTableToolbar basePath="/admin/roles" searchParams={params} searchPlaceholder="Search name or description" />}
      />
    </>
  );
}
