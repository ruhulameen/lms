import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, Plus, Shield, SquarePen } from "lucide-react";
import { BarChart } from "@/components/admin/bar-chart";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { describeActivity, formatDate, formatDateTime } from "@/lib/activity-details";
import { parseDateRange } from "@/lib/date-range";
import { formatCount } from "@/lib/format";
import { money } from "@/lib/order-display";
import type { SearchParams } from "@/lib/table-params";
import { getCommerceDashboard, getDashboard } from "@/services/dashboard";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = {
  title: "Dashboard",
};

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-xl border bg-white p-4 sm:p-5 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-semibold text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Change({ current, previous }: { current: number; previous: number }) {
  if (current === previous) {
    return (
      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
        <Minus className="size-4" aria-hidden /> Same as previous period ({previous})
      </p>
    );
  }
  const up = current > previous;
  const Icon = up ? ArrowUp : ArrowDown;
  const percent = previous === 0 ? null : Math.round((Math.abs(current - previous) / previous) * 100);
  return (
    <p className={`mt-1 flex items-center gap-1 text-sm ${up ? "text-emerald-700" : "text-red-700"}`}>
      <Icon className="size-4" aria-hidden />
      {up ? "Up" : "Down"} {percent === null ? `from ${previous}` : `${percent}% from ${previous}`} in the previous period
    </p>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePermission("dashboard.view");
  const range = parseDateRange(await searchParams);
  const data = await getDashboard(range, can(user, "activity.view"), {
    posts: can(user, "post.view"),
    media: can(user, "media.view"),
    courses: can(user, "course.view"),
    enrolments: can(user, "enrolment.view"),
    certificates: can(user, "certificate.view"),
    reviews: can(user, "review.moderate"),
  });
  const sales = can(user, "order.view") ? await getCommerceDashboard(range) : null;
  const learning = data.learning;
  const showLearning =
    learning.courses !== null || learning.activeEnrolments !== null || learning.certificates !== null || learning.pendingReviews !== null;

  const quickActions = [
    can(user, "post.create") && { href: "/admin/blog/new", label: "New post", icon: SquarePen },
    can(user, "user.create") && { href: "/admin/employees/new", label: "New employee", icon: Plus },
    can(user, "role.manage") && { href: "/admin/roles/new", label: "New role", icon: Shield },
  ].filter((a) => a !== false);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name}.`}
        actions={quickActions.map((a) => (
          <Button key={a.href} variant="outline" render={<Link href={a.href} />}>
            <a.icon aria-hidden /> {a.label}
          </Button>
        ))}
      />

      <DateRangeFilter basePath="/admin" range={range} />

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total users">
          <p className="text-3xl font-extrabold text-[#0f2a5c]">{formatCount(data.totalUsers)}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {data.byRole.map((r) => (
              <li key={r.name}>
                {r.name}: <span className="font-medium">{formatCount(r.count)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`New sign-ups (${range.label})`}>
          <p className="text-3xl font-extrabold text-[#0f2a5c]">{formatCount(data.signUps)}</p>
          <Change current={data.signUps} previous={data.previousSignUps} />
        </Card>
        <Card title="Accounts by status" className="md:col-span-2">
          <ul className="flex flex-wrap gap-3">
            <li className="flex items-center gap-2"><StatusBadge label="Active" tone="success" /> <span className="font-semibold">{formatCount(data.byStatus.ACTIVE)}</span></li>
            <li className="flex items-center gap-2"><StatusBadge label="Suspended" tone="warning" /> <span className="font-semibold">{formatCount(data.byStatus.SUSPENDED)}</span></li>
            <li className="flex items-center gap-2"><StatusBadge label="Banned" tone="danger" /> <span className="font-semibold">{formatCount(data.byStatus.BANNED)}</span></li>
          </ul>
        </Card>
      </div>

      {showLearning && (
        <Card title="Learning" className="mt-6">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
            {learning.courses && (
              <li>
                <p className="text-xs font-medium text-slate-500">Courses</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/courses" className="hover:underline">{formatCount(learning.courses.total)}</Link>
                </p>
                <p className="text-xs text-slate-500">{formatCount(learning.courses.published)} published</p>
              </li>
            )}
            {learning.activeEnrolments !== null && (
              <li>
                <p className="text-xs font-medium text-slate-500">Active enrolments</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/enrolments?status=ACTIVE" className="hover:underline">{formatCount(learning.activeEnrolments)}</Link>
                </p>
              </li>
            )}
            {learning.completions !== null && (
              <li>
                <p className="text-xs font-medium text-slate-500">Completions</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/enrolments?status=COMPLETED" className="hover:underline">{formatCount(learning.completions)}</Link>
                </p>
              </li>
            )}
            {learning.certificates !== null && (
              <li>
                <p className="text-xs font-medium text-slate-500">Certificates issued</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/certificates" className="hover:underline">{formatCount(learning.certificates)}</Link>
                </p>
              </li>
            )}
            {learning.pendingReviews !== null && (
              <li>
                <p className="text-xs font-medium text-slate-500">Reviews to moderate</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/reviews" className="hover:underline">{formatCount(learning.pendingReviews)}</Link>
                </p>
                {learning.pendingReviews > 0 && <p className="text-xs text-amber-700">Waiting for a decision</p>}
              </li>
            )}
          </ul>
        </Card>
      )}

      {sales && (
        <>
          <Card title={`Sales (${range.label})`} className="mt-6">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <li>
                <p className="text-xs font-medium text-slate-500">Revenue</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">{money(sales.revenue)}</p>
                <p className="text-xs text-slate-500">Paid minus refunded</p>
              </li>
              <li>
                <p className="text-xs font-medium text-slate-500">Paid orders</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/orders" className="hover:underline">{formatCount(sales.paidOrders)}</Link>
                </p>
              </li>
              <li>
                <p className="text-xs font-medium text-slate-500">Average order value</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">{money(sales.averageOrderValue)}</p>
                <p className="text-xs text-slate-500">Before refunds</p>
              </li>
              <li>
                <p className="text-xs font-medium text-slate-500">Refunds</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">{money(sales.refunds)}</p>
              </li>
            </ul>
            <div className="mt-5 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Revenue per day (by order date)</p>
              {sales.paidOrders === 0 ? (
                <EmptyState title="No paid orders in this period" description="Pick a longer range to see more." />
              ) : (
                <BarChart
                  data={sales.revenuePerDay}
                  label={`Revenue per day, ${range.label}: ${money(sales.revenue)} in total`}
                  describe={(d) => `${d.date}: ${money(d.count)}`}
                  formatPeak={(max) => `${money(max)} per day`}
                />
              )}
            </div>
          </Card>

          <Card title="Latest orders" className="mt-6">
            {sales.latestOrders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <ul className="divide-y">
                {sales.latestOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">{o.orderNumber}</Link>
                      <span className="block truncate text-xs text-slate-500">{o.learner} - {formatDateTime(o.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">{money(o.total)}</span>
                      <OrderStatusBadge status={o.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {(data.content.posts || data.content.media !== null) && (
        <Card title="Content" className="mt-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {data.content.posts && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Blog posts</p>
                <ul className="flex flex-wrap gap-4">
                  <li className="flex items-center gap-2"><ContentStatusBadge status="PUBLISHED" /> <span className="font-semibold">{formatCount(data.content.posts.published)}</span></li>
                  <li className="flex items-center gap-2"><ContentStatusBadge status="SCHEDULED" /> <span className="font-semibold">{formatCount(data.content.posts.scheduled)}</span></li>
                  <li className="flex items-center gap-2">
                    <ContentStatusBadge status="PENDING_REVIEW" /> <span className="font-semibold">{formatCount(data.content.posts.pendingReview)}</span>
                    {data.content.posts.pendingReview > 0 && can(user, "post.publish") && (
                      <Link href="/admin/blog?status=PENDING_REVIEW" className="text-sm font-medium text-blue-700 hover:underline">Review them</Link>
                    )}
                  </li>
                  <li className="flex items-center gap-2"><ContentStatusBadge status="DRAFT" /> <span className="font-semibold">{formatCount(data.content.posts.drafts)}</span></li>
                </ul>
              </div>
            )}
            {data.content.media !== null && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Media library</p>
                <p className="text-2xl font-extrabold text-[#0f2a5c]">
                  <Link href="/admin/media" className="hover:underline">{formatCount(data.content.media)}</Link>
                  <span className="ml-2 text-sm font-normal text-slate-500">file{data.content.media === 1 ? "" : "s"}</span>
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title={`Sign-ups per day (${range.label})`} className="mt-6">
        {data.signUps === 0 ? (
          <EmptyState title="No sign-ups in this period" description="Pick a longer range to see more." />
        ) : (
          <BarChart
            data={data.signUpsPerDay}
            label={`Sign-ups per day, ${range.label}: ${data.signUps} in total`}
          />
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Newest users">
          {data.recentUsers.length === 0 ? (
            <EmptyState title="No users yet" />
          ) : (
            <ul className="divide-y">
              {data.recentUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    {can(user, "user.view") ? (
                      <Link href={`/admin/employees/${u.id}`} className="font-medium text-blue-700 hover:underline">{u.name}</Link>
                    ) : (
                      <span className="font-medium">{u.name}</span>
                    )}
                    <span className="block truncate text-xs text-slate-500">{u.email}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    {u.role?.name ?? "no role"}
                    <span className="block">{formatDate(u.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {data.recentActivity && (
          <Card title="Recent activity">
            {data.recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="py-2 text-sm">
                    <span className="font-medium">{a.action}</span>
                    {describeActivity(a.action, a.details) && (
                      <span className="text-slate-600"> - {describeActivity(a.action, a.details)}</span>
                    )}
                    <span className="block text-xs text-slate-500">
                      {a.user?.name ?? "System"} - {formatDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/activity-logs" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
              View all activity
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}
