import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CircleCheck, Pause } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { EnrolmentStatusBadge, ProgressCell } from "@/components/admin/enrolment-table";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { UserForm } from "@/components/admin/user-form";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { setUserStatus } from "@/actions/user";
import { money } from "@/lib/order-display";
import { describeActivity, formatDate, formatDateTime } from "@/lib/activity-details";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { listActivity } from "@/services/activity";
import { manageableCoursesWhere } from "@/services/course-access";
import { listEnrolments } from "@/services/learners";
import { listUserOrders } from "@/services/order-admin";
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

  // Courses this user takes; needs enrolment.view.
  const learning = can(viewer, "enrolment.view")
    ? await listEnrolments({ userId: user.id, page: 1, pageSize: 5, sort: "activity", order: "desc" }, manageableCoursesWhere(viewer))
    : null;

  // Orders this user placed; needs order.view.
  const orders = can(viewer, "order.view") ? await listUserOrders(user.id, 5) : null;

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

      {learning && (
        <section aria-labelledby="learning" className="mt-6 rounded-xl border bg-white">
          <div className="flex items-center justify-between gap-3 p-4 sm:px-6">
            <h2 id="learning" className="text-base font-bold text-slate-900">Learning</h2>
            <span className="flex gap-4 text-sm font-medium">
              {can(viewer, "enrolment.manage") && (
                <Link href={`/admin/enrolments/new?user=${user.id}`} className="text-blue-700 hover:underline">
                  Assign a course
                </Link>
              )}
              {learning.total > 0 && (
                <Link href={`/admin/learners/${user.id}`} className="text-blue-700 hover:underline">
                  View progress
                </Link>
              )}
            </span>
          </div>
          {learning.rows.length === 0 ? (
            <EmptyState title="No courses" description="This user has not joined or been assigned a course." />
          ) : (
            <ul className="divide-y border-t">
              {learning.rows.map((enrolment) => (
                <li key={enrolment.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-6">
                  <span className="min-w-0 flex-1 font-medium">{enrolment.course.title}</span>
                  <EnrolmentStatusBadge status={enrolment.status} />
                  <ProgressCell percent={enrolment.progressPercent} done={enrolment.lessonsDone} total={enrolment.lessonsTotal} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {orders && (
        <section aria-labelledby="orders" className="mt-6 rounded-xl border bg-white">
          <div className="flex items-center justify-between gap-3 p-4 sm:px-6">
            <h2 id="orders" className="text-base font-bold text-slate-900">Orders</h2>
            {orders.total > 0 && (
              <Link href={`/admin/orders?user=${user.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                View all {orders.total}
              </Link>
            )}
          </div>
          {orders.rows.length === 0 ? (
            <EmptyState title="No orders" description="This user has not bought a course." />
          ) : (
            <ul className="divide-y border-t">
              {orders.rows.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm sm:px-6">
                  <span className="min-w-0 flex-1">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                      {order.orderNumber}
                    </Link>
                    <span className="block truncate text-slate-600">{order.courses[0]}{order.courses.length > 1 ? ` +${order.courses.length - 1}` : ""}</span>
                  </span>
                  <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                  <OrderStatusBadge status={order.status} />
                  <span className="w-16 text-right font-medium tabular-nums">{money(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
