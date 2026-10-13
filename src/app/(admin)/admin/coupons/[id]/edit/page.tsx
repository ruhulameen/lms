import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy } from "lucide-react";
import { CouponForm } from "@/components/admin/coupon-form";
import { CouponStatusBadge } from "@/components/admin/coupon-status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/activity-details";
import { money } from "@/lib/order-display";
import { parseRouteId } from "@/lib/route-id";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { listCourseCategoryOptions } from "@/services/course-admin";
import { getCouponForEdit, listCouponLearnerOptions, listCouponRedemptions } from "@/services/coupon-admin";
import { listCourseOptions } from "@/services/learners";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Coupon" };

export default async function EditCouponPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("coupon.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const [coupon, usage, courses, categories, learners] = await Promise.all([
    getCouponForEdit(id),
    listCouponRedemptions(id),
    listCourseOptions(),
    listCourseCategoryOptions(),
    listCouponLearnerOptions(),
  ]);
  if (!coupon) notFound();
  const canManage = can(viewer, "coupon.manage");
  const canSeeOrders = can(viewer, "order.view");

  return (
    <>
      <PageHeader
        title={coupon.code}
        description={coupon.description ?? "Edit the coupon's rules and see where it was used."}
        actions={
          <>
            <CouponStatusBadge state={coupon.state} />
            <Button variant="outline" render={<Link href="/admin/coupons" />}>
              <ChevronLeft aria-hidden /> Coupons
            </Button>
            {canManage && (
              <Button variant="outline" render={<Link href={`/admin/coupons/new?from=${coupon.id}`} />}>
                <Copy aria-hidden /> Duplicate
              </Button>
            )}
          </>
        }
      />
      {firstParam(query.created) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Coupon created.
        </p>
      )}

      <CouponForm mode="edit" coupon={coupon} courses={courses} categories={categories} learners={learners} readOnly={!canManage} />

      <section aria-labelledby="usage" className="mt-8 max-w-5xl rounded-xl border bg-white">
        <div className="p-4 sm:px-6">
          <h2 id="usage" className="text-base font-bold text-slate-900">Usage</h2>
          <p className="mt-1 text-sm text-slate-500">
            {usage.uses} {usage.uses === 1 ? "use" : "uses"} counted
            {coupon.usageLimit !== null ? ` of ${coupon.usageLimit}` : ""}. Discount given on paid orders: {money(usage.discountGiven)}.
            {canSeeOrders && usage.rows.length > 0 && (
              <>
                {" "}
                <Link href={`/admin/orders?coupon=${id}`} className="font-medium text-blue-700 hover:underline">
                  View these orders
                </Link>
              </>
            )}
          </p>
        </div>
        {usage.rows.length === 0 ? (
          <EmptyState title="Not used yet" description="Orders that use this coupon are listed here." />
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <caption className="sr-only">Uses of {coupon.code}</caption>
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                  <th scope="col" className="px-4 py-2 font-medium sm:px-6">Learner</th>
                  <th scope="col" className="px-3 py-2 font-medium">Order</th>
                  <th scope="col" className="px-3 py-2 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Discount</th>
                  <th scope="col" className="px-3 py-2 font-medium">Use</th>
                </tr>
              </thead>
              <tbody>
                {usage.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-2.5 sm:px-6">
                      <span className="font-medium">{r.user.name}</span>
                      <span className="block text-xs text-slate-500">{r.user.email}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {canSeeOrders ? (
                        <Link href={`/admin/orders/${r.order.id}`} className="font-mono text-xs text-blue-700 hover:underline">
                          {r.order.orderNumber}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{r.order.orderNumber}</span>
                      )}
                      <span className="mt-1 block">
                        <OrderStatusBadge status={r.order.status} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(r.order.discount)}</td>
                    <td className="px-3 py-2.5">
                      {r.releasedAt ? (
                        <span>
                          <StatusBadge label="Given back" tone="neutral" />
                          <span className="block text-xs text-slate-500">{formatDateTime(r.releasedAt)}</span>
                        </span>
                      ) : (
                        <StatusBadge label="Counted" tone="success" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
