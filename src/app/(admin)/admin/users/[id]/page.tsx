import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CircleCheck, Pause } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { setUserStatus } from "@/actions/user";
import { describeActivity, formatDate, formatDateTime } from "@/lib/activity-details";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { listActivity } from "@/services/activity";
import { can, getUserDetail, listRoleOptions, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermission("user.view");
  const { id: rawId } = await params;
  const query = await searchParams;
  const id = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(id)) notFound();

  const [user, roles] = await Promise.all([getUserDetail(id), listRoleOptions()]);
  if (!user) notFound();

  // Activity done by this user; needs activity.view.
  const activity = can(viewer, "activity.view")
    ? await listActivity({ userId: user.id, pageSize: 10 })
    : null;

  const isSelf = viewer.id === user.id;
  const fields = { id: String(user.id) };

  return (
    <>
      <PageHeader
        title={user.name}
        description={user.email}
        actions={<UserStatusBadge status={user.status} />}
      />
      {firstParam(query.created) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          User created. Share the initial password with them yourself.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="details" className="rounded-xl border bg-white p-4 sm:p-6">
          <h2 id="details" className="mb-4 text-base font-bold text-slate-900">Details</h2>
          <UserForm
            mode="edit"
            roles={roles}
            user={{ id: user.id, name: user.name, email: user.email, roleId: user.roleId }}
            readOnly={!can(viewer, "user.edit")}
            roleLockedReason={isSelf ? "You cannot change your own role." : undefined}
          />
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="account" className="rounded-xl border bg-white p-4 sm:p-6">
            <h2 id="account" className="mb-3 text-base font-bold text-slate-900">Account</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
              <dt className="text-slate-500">Email</dt>
              <dd>{user.emailVerified ? "Verified" : "Not verified"}</dd>
              <dt className="text-slate-500">2FA</dt>
              <dd>{user.twoFactorEnabled ? "On" : "Off"}</dd>
            </dl>
            {can(viewer, "user.status") && (
              <div className="mt-4 border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Status</h3>
                {isSelf ? (
                  <p className="text-sm text-slate-500">You cannot change your own status.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.status !== "ACTIVE" && (
                      <ConfirmDialog
                        action={setUserStatus}
                        fields={{ ...fields, status: "ACTIVE" }}
                        title="Reactivate this user?"
                        description={`${user.name} will be able to sign in again.`}
                        trigger={<><CircleCheck aria-hidden /> Reactivate</>}
                        confirmLabel="Reactivate"
                      />
                    )}
                    {user.status !== "SUSPENDED" && (
                      <ConfirmDialog
                        action={setUserStatus}
                        fields={{ ...fields, status: "SUSPENDED" }}
                        title="Suspend this user?"
                        description={`${user.name} will be signed out everywhere right away and cannot sign in until reactivated.`}
                        trigger={<><Pause aria-hidden /> Suspend</>}
                        confirmLabel="Suspend"
                      />
                    )}
                    {user.status !== "BANNED" && (
                      <ConfirmDialog
                        action={setUserStatus}
                        fields={{ ...fields, status: "BANNED" }}
                        title="Ban this user?"
                        description={`${user.name} will be signed out everywhere right away and cannot sign in until reactivated.`}
                        trigger={<><Ban aria-hidden /> Ban</>}
                        triggerVariant="destructive"
                        confirmLabel="Ban user"
                        destructive
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {activity && (
        <section aria-labelledby="recent" className="mt-6 rounded-xl border bg-white">
          <div className="flex items-center justify-between p-4 sm:px-6">
            <h2 id="recent" className="text-base font-bold text-slate-900">Recent activity</h2>
            <Link
              href={`/admin/activity-logs?q=${encodeURIComponent(user.email)}`}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              View all
            </Link>
          </div>
          {activity.rows.length === 0 ? (
            <EmptyState title="No activity yet" description="Actions this user takes appear here." />
          ) : (
            <ul className="divide-y border-t">
              {activity.rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:px-6">
                  <span>
                    <span className="font-medium">{row.action}</span>
                    {describeActivity(row.action, row.details) && (
                      <span className="text-slate-600"> - {describeActivity(row.action, row.details)}</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(row.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
