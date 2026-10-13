import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/activity-details";
import { cardBrandLabel, money } from "@/lib/order-display";
import type { LearnerOrderRow, LearnerRefundRow } from "@/services/learner-insight";

const Heading = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-base font-bold text-slate-900">
    {children}
  </h2>
);

const sentence = (courses: string[]) => (courses.length === 0 ? "-" : courses.join(", "));

// Orders and payments, newest first, capped with a link to the full list.
export function LearnerOrdersSection({ userId, orders, total }: { userId: number; orders: LearnerOrderRow[]; total: number }) {
  return (
    <section aria-labelledby="orders" className="scroll-mt-4 overflow-hidden rounded-xl border bg-white">
      <div className="flex items-center justify-between gap-3 p-4 sm:px-6">
        <Heading id="orders">Orders and payments</Heading>
        {total > orders.length && (
          <Link href={`/admin/orders?user=${userId}`} className="text-sm font-medium text-blue-700 hover:underline">
            View all {total}
          </Link>
        )}
      </div>
      {orders.length === 0 ? (
        <EmptyState title="No orders" description="This learner has not bought a course." />
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <caption className="sr-only">Orders</caption>
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-2 sm:px-6">Order</th>
                <th scope="col" className="px-3 py-2">Date</th>
                <th scope="col" className="px-3 py-2">Courses</th>
                <th scope="col" className="px-3 py-2">Coupon</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2 text-right">Total</th>
                <th scope="col" className="px-3 py-2 text-right">Refunded</th>
                <th scope="col" className="px-3 py-2">Paid</th>
                <th scope="col" className="px-3 py-2 sm:pr-6">Card</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 sm:px-6">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  <td className="max-w-56 truncate px-3 py-2.5" title={sentence(o.courses)}>
                    {sentence(o.courses)}
                  </td>
                  <td className="px-3 py-2.5">{o.couponCode ? <span className="font-mono text-xs">{o.couponCode}</span> : <span className="text-slate-400">None</span>}</td>
                  <td className="px-3 py-2.5">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(o.total)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.refunded > 0 ? money(o.refunded) : <span className="text-slate-400">-</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.paidAt ? formatDate(o.paidAt) : <span className="text-slate-400">-</span>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap sm:pr-6">
                    {o.cardLast4 ? `${o.cardBrand ? cardBrandLabel(o.cardBrand) : "Card"} ${o.cardLast4}` : <span className="text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const refundTones = { SUCCEEDED: "success", PENDING: "warning", FAILED: "danger" } as const;
const refundLabels = { SUCCEEDED: "Refunded", PENDING: "Pending", FAILED: "Failed" } as const;

export function LearnerRefundsSection({ refunds }: { refunds: LearnerRefundRow[] }) {
  return (
    <section aria-labelledby="refunds" className="scroll-mt-4 rounded-xl border bg-white">
      <div className="p-4 sm:px-6">
        <Heading id="refunds">Refunds</Heading>
      </div>
      {refunds.length === 0 ? (
        <EmptyState title="No refunds" description="Nothing has been refunded to this learner." />
      ) : (
        <ul className="divide-y border-t">
          {refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
              <span className="min-w-0 flex-1">
                <Link href={`/admin/orders/${r.orderId}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                  {r.orderNumber}
                </Link>
                <span className="block truncate text-slate-600">{sentence(r.courses)}</span>
                {r.reason && <span className="block truncate text-xs text-slate-500">Reason: {r.reason}</span>}
              </span>
              <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
              <StatusBadge label={refundLabels[r.status]} tone={refundTones[r.status]} />
              <span className="w-20 text-right font-medium tabular-nums">{money(r.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
