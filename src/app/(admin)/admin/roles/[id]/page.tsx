import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Pencil } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import { permissionGroups } from "@/lib/permissions";
import { parseRouteId } from "@/lib/route-id";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { getRoleDetail } from "@/services/role";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Role" };

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermission("role.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;

  const role = await getRoleDetail(id);
  if (!role) notFound();

  const isStudent = role.name === "student";
  const isAdmin = role.name === "admin";
  const granted = new Set(role.keys);
  const peopleBase = isStudent ? "/admin/learners" : "/admin/employees";

  return (
    <>
      <PageHeader
        title={role.name}
        description={role.description ?? undefined}
        actions={
          <>
            {role.system && <StatusBadge label="System" tone="neutral" />}
            {can(viewer, "role.manage") && !role.system && (
              <Button render={<Link href={`/admin/roles/${role.id}/edit`} />}>
                <Pencil aria-hidden /> Edit
              </Button>
            )}
          </>
        }
      />
      {(firstParam(query.created) || firstParam(query.saved)) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {firstParam(query.created) ? "Role created." : "Role saved."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="permissions" className="rounded-xl border bg-white p-4 sm:p-6">
          <h2 id="permissions" className="mb-1 text-base font-bold text-slate-900">Permissions</h2>
          {isAdmin ? (
            <p className="text-sm text-slate-600">The admin role is the superuser and has every permission.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">
                {role.keys.length} of {permissionGroups.reduce((n, g) => n + g.permissions.length, 0)} granted.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {permissionGroups.map((group) => {
                  const given = group.permissions.filter((p) => granted.has(p.key));
                  return (
                    <div key={group.key}>
                      <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{group.label}</h3>
                      {given.length === 0 ? (
                        <p className="text-sm text-slate-400">None</p>
                      ) : (
                        <ul className="grid gap-1 text-sm">
                          {given.map((p) => (
                            <li key={p.key} className="flex items-start gap-1.5" title={p.description}>
                              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                              {p.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="people" className="self-start rounded-xl border bg-white">
          <div className="flex items-center justify-between gap-3 p-4 sm:px-6">
            <h2 id="people" className="text-base font-bold text-slate-900">People ({role.userCount})</h2>
            {role.userCount > role.users.length && (
              <Link
                // The learners list is every student already, so it needs no role filter.
                href={isStudent ? peopleBase : `${peopleBase}?role=${encodeURIComponent(role.name)}`}
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          {role.users.length === 0 ? (
            <EmptyState title="Nobody has this role" />
          ) : (
            <ul className="divide-y border-t">
              {role.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
                  <span className="min-w-0">
                    <Link href={`${peopleBase}/${u.id}`} className="font-medium text-blue-700 hover:underline">
                      {u.name}
                    </Link>
                    <span className="block truncate text-xs text-slate-500">{u.email}</span>
                  </span>
                  <UserStatusBadge status={u.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
