import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  BookOpen,
  GraduationCap,
  type LucideIcon,
  MessageSquareWarning,
  Plus,
  ReceiptText,
  RotateCcw,
  Shield,
  ShoppingCart,
  SquarePen,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { DonutChart, TimeChart } from "@/components/admin/charts";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { EmptyState } from "@/components/admin/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { describeActivity, formatDate, formatDateTime } from "@/lib/activity-details";
import { formatDateInput, formatRangeDates, parseDateRange } from "@/lib/date-range";
import { formatCount } from "@/lib/format";
import { money } from "@/lib/order-display";
import type { SearchParams } from "@/lib/table-params";
import { getCommerceDashboard, getDashboard, getEarliestRecordDate } from "@/services/dashboard";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = {
  title: "Dashboard",
};

function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,42,92,0.04)] ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const viewAll = (href: string, label = "View all") => (
  <Link href={href} className="shrink-0 text-sm font-medium text-blue-700 hover:underline">
    {label}
  </Link>
);

// One row of a totals list: icon, label, figure. For totals that do not depend on the date range.
function Snapshot({ icon: Icon, label, value, href, note }: { icon: LucideIcon; label: string; value: number; href: string; note?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-700">{label}</span>
          {note && <span className="block text-xs text-amber-700">{note}</span>}
        </span>
        <span className="text-base font-bold text-[#0f2a5c] tabular-nums">{formatCount(value)}</span>
      </Link>
    </li>
  );
}

const ROLE_COLOURS = ["#2563eb", "#0f2a5c", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#64748b"];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePermission("dashboard.view");
  const params = await searchParams;
  // "All time" starts at the first account; only looked up when asked for.
  const earliest = params.range === "all" ? await getEarliestRecordDate() : null;
  const range = parseDateRange(params, new Date(), { earliest });
  const [data, sales] = await Promise.all([
    getDashboard(range, can(user, "activity.view"), {
      posts: can(user, "post.view"),
      media: can(user, "media.view"),
      courses: can(user, "course.view"),
      enrolments: can(user, "enrolment.view"),
      certificates: can(user, "certificate.view"),
      reviews: can(user, "review.moderate"),
    }),
    can(user, "order.view") ? getCommerceDashboard(range) : null,
  ]);
  const learning = data.learning;
  const showLearning =
    learning.courses !== null || learning.activeEnrolments !== null || learning.certificates !== null || learning.pendingReviews !== null;
  const per = range.bucket === "month" ? "month" : "day";
  const lastDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);

  const quickActions = [
    can(user, "post.create") && { href: "/admin/blog/new", label: "New post", icon: SquarePen },
    can(user, "user.create") && { href: "/admin/employees/new", label: "New employee", icon: Plus },
    can(user, "role.manage") && { href: "/admin/roles/new", label: "New role", icon: Shield },
  ].filter((a) => a !== false);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name}. Showing ${formatRangeDates(range.from, range.to)}.`}
        actions={
          <>
            {quickActions.map((a) => (
              <Button key={a.href} variant="outline" className="h-10 bg-white" render={<Link href={a.href} />}>
                <a.icon aria-hidden /> {a.label}
              </Button>
            ))}
            <DateRangePicker
              // Remounts when the range changes, so the calendar opens on the new dates.
              key={`${range.preset}-${formatDateInput(range.from)}-${formatDateInput(lastDay)}`}
              basePath="/admin"
              preset={range.preset}
              from={formatDateInput(range.from)}
              to={formatDateInput(lastDay)}
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sales && (
          <>
            <StatCard label="Revenue" value={money(sales.revenue)} icon={Wallet} tone="emerald" current={sales.revenue} previous={sales.previous?.revenue} note={sales.previous ? undefined : "Paid minus refunded"} />
            <StatCard label="Paid orders" value={formatCount(sales.paidOrders)} icon={ShoppingCart} tone="blue" current={sales.paidOrders} previous={sales.previous?.paidOrders} />
            <StatCard label="Average order value" value={money(sales.averageOrderValue)} icon={ReceiptText} tone="violet" current={sales.averageOrderValue} previous={sales.previous?.averageOrderValue} note={sales.previous ? undefined : "Before refunds"} />
            <StatCard label="Refunds" value={money(sales.refunds)} icon={RotateCcw} tone="rose" current={sales.refunds} previous={sales.previous?.refunds} lowerIsBetter />
          </>
        )}
        <StatCard label="New sign-ups" value={formatCount(data.signUps)} icon={UserPlus} tone="amber" current={data.signUps} previous={data.previousSignUps} />
        {learning.newEnrolments !== null && (
          <StatCard label="New enrolments" value={formatCount(learning.newEnrolments)} icon={GraduationCap} tone="blue" current={learning.newEnrolments} previous={learning.previousEnrolments} />
        )}
        {learning.activeEnrolments !== null && (
          <StatCard label="Active enrolments" value={formatCount(learning.activeEnrolments)} icon={TrendingUp} tone="emerald" note="Right now, all time" />
        )}
        <StatCard label="Total users" value={formatCount(data.totalUsers)} icon={Users} tone="slate" note="Right now, all time" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {sales && (
          <Panel
            title="Revenue"
            description={`Per ${per}, by the date the order was placed. ${range.label}.`}
            action={viewAll("/admin/orders", "Orders")}
            className="xl:col-span-2"
          >
            {sales.paidOrders === 0 ? (
              <EmptyState title="No paid orders in this period" description="Pick a longer range to see more." />
            ) : (
              <TimeChart points={sales.revenueSeries} name="Revenue" prefix="£" color="#10b981" />
            )}
          </Panel>
        )}

        <Panel title="Users by role" description="Every account, right now.">
          <DonutChart
            name="Users by role"
            total={formatCount(data.totalUsers)}
            caption="users"
            slices={data.byRole.filter((r) => r.count > 0).map((r, i) => ({ name: r.name, value: r.count, color: ROLE_COLOURS[i % ROLE_COLOURS.length] }))}
          />
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {data.byRole
              .filter((r) => r.count > 0)
              .map((r, i) => (
                <li key={r.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ROLE_COLOURS[i % ROLE_COLOURS.length] }} aria-hidden />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatCount(r.count)}</span>
                </li>
              ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-sm">
            <li className="flex items-center gap-1.5"><StatusBadge label="Active" tone="success" /> <span className="font-semibold tabular-nums">{formatCount(data.byStatus.ACTIVE)}</span></li>
            <li className="flex items-center gap-1.5"><StatusBadge label="Suspended" tone="warning" /> <span className="font-semibold tabular-nums">{formatCount(data.byStatus.SUSPENDED)}</span></li>
            <li className="flex items-center gap-1.5"><StatusBadge label="Banned" tone="danger" /> <span className="font-semibold tabular-nums">{formatCount(data.byStatus.BANNED)}</span></li>
          </ul>
        </Panel>

        <Panel title="Sign-ups" description={`New accounts per ${per}. ${range.label}.`} className="xl:col-span-2">
          {data.signUps === 0 ? (
            <EmptyState title="No sign-ups in this period" description="Pick a longer range to see more." />
          ) : (
            <TimeChart points={data.signUpSeries} name="Sign-ups" type="column" color="#2563eb" height={240} />
          )}
        </Panel>

        {showLearning && (
          <Panel title="Learning" description="Totals right now.">
            <ul className="divide-y divide-slate-100">
              {learning.courses && (
                <Snapshot icon={BookOpen} label={`Courses, ${formatCount(learning.courses.published)} published`} value={learning.courses.total} href="/admin/courses" />
              )}
              {learning.activeEnrolments !== null && (
                <Snapshot icon={GraduationCap} label="Active enrolments" value={learning.activeEnrolments} href="/admin/enrolments?status=ACTIVE" />
              )}
              {learning.completions !== null && (
                <Snapshot icon={TrendingUp} label="Completions" value={learning.completions} href="/admin/enrolments?status=COMPLETED" />
              )}
              {learning.certificates !== null && (
                <Snapshot icon={Award} label="Certificates issued" value={learning.certificates} href="/admin/certificates" />
              )}
              {learning.pendingReviews !== null && (
                <Snapshot
                  icon={MessageSquareWarning}
                  label="Reviews to moderate"
                  value={learning.pendingReviews}
                  href="/admin/reviews"
                  note={learning.pendingReviews > 0 ? "Waiting for a decision" : undefined}
                />
              )}
            </ul>
          </Panel>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {sales && (
          <Panel title="Latest orders" action={viewAll("/admin/orders")}>
            {sales.latestOrders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <ul className="divide-y">
                {sales.latestOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
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
          </Panel>
        )}

        <Panel title="Newest users">
          {data.recentUsers.length === 0 ? (
            <EmptyState title="No users yet" />
          ) : (
            <ul className="divide-y">
              {data.recentUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
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
        </Panel>

        {(data.content.posts || data.content.media !== null) && (
          <Panel title="Content" description="Totals right now.">
            <div className="grid gap-5">
              {data.content.posts && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Blog posts</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <li className="flex items-center gap-1.5"><ContentStatusBadge status="PUBLISHED" /> <span className="font-semibold tabular-nums">{formatCount(data.content.posts.published)}</span></li>
                    <li className="flex items-center gap-1.5"><ContentStatusBadge status="SCHEDULED" /> <span className="font-semibold tabular-nums">{formatCount(data.content.posts.scheduled)}</span></li>
                    <li className="flex items-center gap-1.5">
                      <ContentStatusBadge status="PENDING_REVIEW" /> <span className="font-semibold tabular-nums">{formatCount(data.content.posts.pendingReview)}</span>
                      {data.content.posts.pendingReview > 0 && can(user, "post.publish") && (
                        <Link href="/admin/blog?status=PENDING_REVIEW" className="font-medium text-blue-700 hover:underline">Review them</Link>
                      )}
                    </li>
                    <li className="flex items-center gap-1.5"><ContentStatusBadge status="DRAFT" /> <span className="font-semibold tabular-nums">{formatCount(data.content.posts.drafts)}</span></li>
                  </ul>
                </div>
              )}
              {data.content.media !== null && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Media library</p>
                  <p className="text-lg font-bold text-[#0f2a5c]">
                    <Link href="/admin/media" className="hover:underline">{formatCount(data.content.media)}</Link>
                    <span className="ml-1.5 text-sm font-normal text-slate-500">file{data.content.media === 1 ? "" : "s"}</span>
                  </p>
                </div>
              )}
            </div>
          </Panel>
        )}

        {data.recentActivity && (
          <Panel title="Recent activity" action={viewAll("/admin/activity-logs")}>
            {data.recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="py-2.5 text-sm">
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
          </Panel>
        )}
      </div>
    </>
  );
}
