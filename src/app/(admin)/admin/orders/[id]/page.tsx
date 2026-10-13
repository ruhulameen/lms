import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, ChevronLeft, ExternalLink } from "lucide-react";
import { cancelOrderAction } from "@/actions/order-admin";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { OrderNoteForm } from "@/components/admin/order-note-form";
import { OrderRefundControls } from "@/components/admin/order-refund-controls";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/activity-details";
import { canTransition } from "@/lib/commerce";
import { money, cardBrandLabel } from "@/lib/order-display";
import { parseRouteId } from "@/lib/route-id";
import { getAdminOrder } from "@/services/order-admin";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Order" };

const countryNames = new Intl.DisplayNames("en-GB", { type: "region" });
const countryName = (code: string) => {
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
};

function Section({ id, title, children, aside }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-white p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-bold text-slate-900">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const paymentTones = { SUCCEEDED: "success", PENDING: "warning", FAILED: "danger", CANCELLED: "neutral" } as const;
const refundTones = { SUCCEEDED: "success", PENDING: "warning", FAILED: "danger" } as const;
const enrolmentLabels = { ACTIVE: "In progress", COMPLETED: "Completed", CANCELLED: "Access removed" } as const;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("order.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const canManage = can(viewer, "order.manage");
  const canRefund = can(viewer, "order.refund");
  const canCancel = canManage && canTransition(order.status, "CANCELLED");
  const b = order.billing;
  const learnerLink = can(viewer, "enrolment.view") ? `/admin/learners/${order.learner.id}` : null;

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <Button variant="outline" render={<Link href="/admin/orders" />}>
              <ChevronLeft aria-hidden /> Orders
            </Button>
            {canCancel && (
              <ConfirmDialog
                action={cancelOrderAction}
                fields={{ orderId: String(order.id) }}
                title="Cancel this order?"
                description={`Order ${order.orderNumber} will be cancelled and ${order.couponCode ? `the use of coupon ${order.couponCode} given back` : "nothing will be charged"}. Use this only for an order that was never paid. If the learner is paying right now, the cancel is refused.`}
                trigger={<><Ban aria-hidden /> Cancel order</>}
                triggerVariant="destructive"
                confirmLabel="Cancel order"
                destructive
              />
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <Section id="lines" title="Courses">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Courses on this order</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th scope="col" className="py-2 pr-3 font-medium">Course</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Discount</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                    <th scope="col" className="py-2 pl-3 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 align-top">
                      <td className="py-2.5 pr-3">
                        {can(viewer, "course.view") ? (
                          <Link href={`/admin/courses/${item.courseId}`} className="font-medium text-blue-700 hover:underline">
                            {item.courseTitle}
                          </Link>
                        ) : (
                          <span className="font-medium">{item.courseTitle}</span>
                        )}
                        {item.refundedAt && (
                          <span className="ml-2 align-middle">
                            <StatusBadge label={`Refunded ${formatDateTime(item.refundedAt)}`} tone="info" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{item.discount > 0 ? `-${money(item.discount)}` : "-"}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{money(item.total)}</td>
                      <td className="py-2.5 pl-3">
                        {item.enrolment ? (
                          <span>
                            {enrolmentLabels[item.enrolment.status]}
                            {item.enrolment.status !== "CANCELLED" && <span className="text-xs text-slate-500"> ({item.enrolment.progressPercent}%)</span>}
                            {can(viewer, "enrolment.view") && (
                              <Link href={`/admin/learners/${order.learner.id}`} className="block text-xs text-blue-700 hover:underline">
                                View progress
                              </Link>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">{order.status === "PAID" ? "Not enrolled" : "Not yet"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="text-right tabular-nums">{money(order.subtotal)}</dd>
              {order.discountTotal > 0 && (
                <>
                  <dt className="text-slate-500">
                    Coupon{" "}
                    {order.couponCode &&
                      (order.couponId && can(viewer, "coupon.view") ? (
                        <Link href={`/admin/coupons/${order.couponId}/edit`} className="font-mono text-xs text-blue-700 hover:underline">
                          {order.couponCode}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{order.couponCode}</span>
                      ))}
                  </dt>
                  <dd className="text-right tabular-nums">-{money(order.discountTotal)}</dd>
                </>
              )}
              <dt className="font-semibold">Total (includes VAT)</dt>
              <dd className="text-right font-semibold tabular-nums">{money(order.total)}</dd>
              {order.refundedTotal > 0 && (
                <>
                  <dt className="text-slate-500">Refunded</dt>
                  <dd className="text-right tabular-nums">-{money(order.refundedTotal)}</dd>
                </>
              )}
            </dl>
          </Section>

          <Section id="payments" title="Payments">
            {order.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payment has been started for this order.</p>
            ) : (
              <ul className="grid gap-3">
                {order.payments.map((p) => (
                  <li key={p.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={p.status.charAt(0) + p.status.slice(1).toLowerCase()} tone={paymentTones[p.status]} />
                      <span className="font-medium tabular-nums">{money(p.amount)}</span>
                      <span className="text-slate-600">
                        {p.provider === "FREE" ? "No payment needed" : p.cardLast4 ? `${p.cardBrand ? cardBrandLabel(p.cardBrand) : "Card"} ending ${p.cardLast4}` : "Card"}
                      </span>
                      <span className="text-xs text-slate-500">{formatDateTime(p.paidAt ?? p.createdAt)}</span>
                      {p.receiptUrl && (
                        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                          Receipt <ExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </div>
                    {p.failureMessage && <p className="mt-2 text-sm text-red-700">{p.failureMessage}</p>}
                    {(p.stripeCheckoutSessionId || p.stripePaymentIntentId || p.stripeChargeId) && (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {p.stripeCheckoutSessionId && (
                          <>
                            <dt>Checkout session</dt>
                            <dd className="break-all font-mono">{p.stripeCheckoutSessionId}</dd>
                          </>
                        )}
                        {p.stripePaymentIntentId && (
                          <>
                            <dt>Payment intent</dt>
                            <dd className="break-all font-mono">{p.stripePaymentIntentId}</dd>
                          </>
                        )}
                        {p.stripeChargeId && (
                          <>
                            <dt>Charge</dt>
                            <dd className="break-all font-mono">{p.stripeChargeId}</dd>
                          </>
                        )}
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="refunds" title="Refunds">
            {/* Stage 3: the refund controls live in this component. */}
            <OrderRefundControls order={order} canRefund={canRefund} />
            {order.refunds.length === 0 ? (
              <p className="text-sm text-slate-500">This order has not been refunded.</p>
            ) : (
              <ul className="grid gap-3">
                {order.refunds.map((r) => (
                  <li key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={r.status.charAt(0) + r.status.slice(1).toLowerCase()} tone={refundTones[r.status]} />
                      <span className="font-medium tabular-nums">{money(r.amount)}</span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(r.createdAt)}
                        {r.createdBy ? ` by ${r.createdBy.name}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{r.courses.join(", ")}</p>
                    {r.reason && <p className="mt-1 text-slate-600">Reason: {r.reason}</p>}
                    {r.failureMessage && <p className="mt-1 text-red-700">{r.failureMessage}</p>}
                    {r.stripeRefundId && <p className="mt-1 break-all font-mono text-xs text-slate-500">{r.stripeRefundId}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="timeline" title="Timeline">
            <OrderTimeline events={order.events} />
            {canManage && (
              <div className="mt-5 border-t pt-4">
                <OrderNoteForm orderId={order.id} />
              </div>
            )}
          </Section>
        </div>

        <div className="grid content-start gap-6">
          <Section id="learner" title="Learner">
            <p className="text-sm font-medium">
              {learnerLink ? (
                <Link href={learnerLink} className="text-blue-700 hover:underline">
                  {order.learner.name}
                </Link>
              ) : (
                order.learner.name
              )}
            </p>
            <p className="text-sm text-slate-600">{order.learner.email}</p>
            <p className="mt-2 text-sm text-slate-500">
              {order.otherOrders === 0 ? (
                "This is their only order."
              ) : (
                <Link href={`/admin/orders?user=${order.learner.id}`} className="text-blue-700 hover:underline">
                  {order.otherOrders} other {order.otherOrders === 1 ? "order" : "orders"}
                </Link>
              )}
            </p>
          </Section>

          <Section id="billing" title="Billing details">
            <address className="text-sm not-italic leading-relaxed text-slate-700">
              <span className="font-medium">{b.name}</span>
              {b.company && <><br />{b.company}</>}
              <br />
              {b.line1}
              {b.line2 && <><br />{b.line2}</>}
              <br />
              {[b.city, b.postcode].filter(Boolean).join(", ")}
              <br />
              {countryName(b.country)}
            </address>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Buyer type</dt>
              <dd>{b.customerType === "BUSINESS" ? "Business" : "Individual"}</dd>
              <dt className="text-slate-500">Email</dt>
              <dd className="break-all">{order.email}</dd>
              {b.phone && (
                <>
                  <dt className="text-slate-500">Phone</dt>
                  <dd>{b.phone}</dd>
                </>
              )}
            </dl>
          </Section>

          <Section id="dates" title="Dates">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Placed</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
              {order.paidAt && (
                <>
                  <dt className="text-slate-500">Paid</dt>
                  <dd>{formatDateTime(order.paidAt)}</dd>
                </>
              )}
              {order.cancelledAt && (
                <>
                  <dt className="text-slate-500">Cancelled</dt>
                  <dd>{formatDateTime(order.cancelledAt)}</dd>
                </>
              )}
              {order.status === "PENDING" && order.expiresAt && (
                <>
                  <dt className="text-slate-500">Expires</dt>
                  <dd>{formatDateTime(order.expiresAt)}</dd>
                </>
              )}
              <dt className="text-slate-500">Updated</dt>
              <dd>{formatDateTime(order.updatedAt)}</dd>
            </dl>
          </Section>
        </div>
      </div>
    </>
  );
}
