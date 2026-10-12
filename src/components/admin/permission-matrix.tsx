"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { savePermissions } from "@/actions/role";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initialFormState } from "@/lib/form-state";

type PermissionMatrixProps = {
  groups: {
    key: string;
    label: string;
    permissions: { key: string; label: string; description: string }[];
  }[];
  roles: { id: number; name: string; keys: string[] }[];
  canManage: boolean;
};

export function PermissionMatrix({ groups, roles, canManage }: PermissionMatrixProps) {
  const [state, formAction, pending] = useActionState(savePermissions, initialFormState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <div className="overflow-x-auto">
        <Table>
          <caption className="sr-only">Permissions by role</caption>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead scope="col">Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id} scope="col" className="text-center">
                  {role.name}
                  {role.name === "admin" && (
                    <span className="block text-xs font-normal text-slate-500">superuser</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <GroupRows key={group.key} group={group} roles={roles} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          The admin role is the superuser: it always has every permission and cannot be edited.
          {!canManage && " You can view permissions but not change them."}
        </p>
        {canManage && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save permissions"}
          </Button>
        )}
      </div>
    </form>
  );
}

function GroupRows({
  group,
  roles,
  canManage,
}: {
  group: PermissionMatrixProps["groups"][number];
  roles: PermissionMatrixProps["roles"];
  canManage: boolean;
}) {
  return (
    <>
      <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
        <TableCell colSpan={roles.length + 1} className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {group.label}
        </TableCell>
      </TableRow>
      {group.permissions.map((permission) => (
        <TableRow key={permission.key}>
          <TableCell>
            <span className="block font-medium text-slate-900">{permission.label}</span>
            <span className="block text-xs text-slate-500">{permission.description}</span>
          </TableCell>
          {roles.map((role) => {
            const isAdmin = role.name === "admin";
            return (
              <TableCell key={role.id} className="text-center">
                <Checkbox
                  name={isAdmin ? undefined : "permissions"}
                  value={`${role.id}:${permission.key}`}
                  defaultChecked={isAdmin || role.keys.includes(permission.key)}
                  disabled={isAdmin || !canManage}
                  aria-label={`${permission.label} for ${role.name}`}
                />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}
