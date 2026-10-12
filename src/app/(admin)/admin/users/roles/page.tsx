import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteRole } from "@/actions/role";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { RoleFormDialog } from "@/components/admin/role-form-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { permissionGroups } from "@/lib/permissions";
import { getPermissionMatrix, listRoles } from "@/services/role";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const viewer = await requirePermission("role.view");
  const canManage = can(viewer, "role.manage");
  const [roles, matrix] = await Promise.all([listRoles(), getPermissionMatrix()]);

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Roles decide what each person can do. Student and instructor use their own panels."
        actions={
          canManage && (
            <RoleFormDialog trigger={<><Plus aria-hidden /> New role</>} triggerVariant="default" />
          )
        }
      />

      <section aria-labelledby="roles" className="mb-6 overflow-hidden rounded-xl border bg-white">
        <h2 id="roles" className="p-4 text-base font-bold text-slate-900 sm:px-6">Roles</h2>
        {roles.length === 0 ? (
          <EmptyState title="No roles yet" description="Create a role to get started." />
        ) : (
          <Table>
            <caption className="sr-only">Roles</caption>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    {role.name}
                    {role.reserved && <StatusBadge label="Reserved" tone="neutral" className="ml-2" />}
                  </TableCell>
                  <TableCell className="whitespace-normal text-slate-600">{role.description ?? "-"}</TableCell>
                  <TableCell className="text-right">{role.userCount}</TableCell>
                  <TableCell className="text-right">
                    {role.name === "admin" ? "All" : role.permissionCount}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <RoleFormDialog
                          role={role}
                          trigger={<><Pencil aria-hidden /> Edit</>}
                          triggerLabel={`Edit role ${role.name}`}
                        />
                        {!role.reserved && (
                          <ConfirmDialog
                            action={deleteRole}
                            fields={{ id: String(role.id) }}
                            title={`Delete role "${role.name}"?`}
                            description={
                              role.userCount > 0
                                ? `${role.userCount} ${role.userCount === 1 ? "user still has" : "users still have"} this role, so it cannot be deleted yet.`
                                : "This removes the role and its permissions. It cannot be undone."
                            }
                            trigger={<><Trash2 aria-hidden /> Delete</>}
                            triggerLabel={`Delete role ${role.name}`}
                            triggerVariant="destructive"
                            confirmLabel="Delete role"
                            destructive
                          />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="matrix" className="overflow-hidden rounded-xl border bg-white">
        <div className="p-4 sm:px-6">
          <h2 id="matrix" className="text-base font-bold text-slate-900">Permission matrix</h2>
          <p className="mt-1 text-sm text-slate-500">
            Roles that use the admin panel. Tick what each role may do, then save.
          </p>
        </div>
        <PermissionMatrix
          groups={permissionGroups.map((g) => ({
            key: g.key,
            label: g.label,
            permissions: g.permissions.map((p) => ({ ...p })),
          }))}
          roles={matrix}
          canManage={canManage}
        />
      </section>
    </>
  );
}
