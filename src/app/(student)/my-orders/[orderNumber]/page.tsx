import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderStatusBadge } from "@/components/student/order-status-badge";
import { PrintButton } from "@/components/student/print-button";
import { billingCountries } from "@/lib/checkout";
import {
  ORDER_NUMBER_PATTERN,
  formatPence,
  isPaidStatus,
  toPence,
} from "@/lib/commerce";
import { getOrderByNumber } from "@/services/order";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Order receipt",
  robots: { index: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const pence = (value: unknown) => formatPence(toPence(Number(value)));

// The order as a receipt the learner can print. Owner only: another learner's
// number is a 404.
export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();
  const user = await requireUser();
  const order = await getOrderByNumber(orderNumber, {
    userId: user.id,
    staff: false,
  });
  if (!order) notFound();

  const payment = order.payments.find((p) => p.status === "SUCCEEDED");
  const discount = Number(order.discountTotal);
  const country =
    billingCountries.find((c) => c.code === order.billingCountry)?.name ??
    order.billingCountry;
  const address = [
    order.billingAddressLine1,
    order.billingAddressLine2,
    order.billingCity,
    order.billingPostcode,
    country,
  ].filter(Boolean);
  const methodLabel = !payment
    ? null
    : payment.provider === "FREE"
      ? "No payment needed"
      : payment.cardBrand
        ? `${payment.cardBrand[0].toUpperCase()}${payment.cardBrand.slice(1)} card${payment.cardLast4 ? ` ending ${payment.cardLast4}` : ""}`
        : "Card (Stripe)";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/my-orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> My orders
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 print:rounded-none print:border-0 print:p-0">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              EdX Learning
            </p>
            <h1 className="text-2xl font-extrabold text-navy">
              {isPaidStatus(order.status) ? "Receipt" : "Order"}
            </h1>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-bold text-navy">{order.orderNumber}</p>
            <p className="text-gray-500">
              {dateFormatter.format(order.paidAt ?? order.createdAt)}
            </p>
            <OrderStatusBadge status={order.status} className="mt-2" />
          </div>
        </header>

        <div className="mb-8 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-bold tracking-wider text-gray-500 uppercase">
              Billed to
            </h2>
            <p className="font-semibold text-gray-800">
              {order.billingFirstName} {order.billingLastName}
            </p>
            {order.billingCompany && (
              <p className="text-gray-700">{order.billingCompany}</p>
            )}
            {address.map((part) => (
              <p key={part} className="text-gray-700">
                {part}
              </p>
            ))}
            <p className="mt-1 text-gray-500">{order.email}</p>
          </div>
          <div>
            <h2 className="mb-1 text-xs font-bold tracking-wider text-gray-500 uppercase">
              Payment
            </h2>
            <p className="text-gray-800">{methodLabel ?? "Not paid"}</p>
            {payment?.paidAt && (
              <p className="text-gray-500">
                Paid {dateFormatter.format(payment.paidAt)}
              </p>
            )}
            {payment?.receiptUrl && (
              <a
                href={payment.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-semibold text-blue-600 hover:underline print:hidden"
              >
                Stripe payment receipt
              </a>
            )}
          </div>
        </div>

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-bold tracking-wider text-gray-500 uppercase">
              <th className="py-2 font-bold">Course</th>
              <th className="py-2 text-right font-bold">Price</th>
              <th className="py-2 text-right font-bold">Discount</th>
              <th className="py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 align-top">
                <td className="py-3 pr-4 font-semibold text-gray-800">
                  {item.courseTitle}
                  {item.refundedAt && (
                    <span className="ml-2 text-xs font-normal text-purple-700">
                      Refunded
                    </span>
                  )}
                </td>
                <td className="py-3 text-right text-gray-700">
                  {pence(item.unitPrice)}
                </td>
                <td className="py-3 text-right text-gray-700">
                  {Number(item.discount) > 0 ? `−${pence(item.discount)}` : "–"}
                </td>
                <td className="py-3 text-right font-semibold text-gray-800">
                  {pence(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Subtotal</dt>
            <dd>{pence(order.subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Coupon{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>−{pence(order.discountTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold text-navy">
            <dt>
              {isPaidStatus(order.status)
                ? "Total paid (inc. VAT)"
                : "Total (inc. VAT)"}
            </dt>
            <dd>{pence(order.total)}</dd>
          </div>
          {order.refunds
            .filter((r) => r.status === "SUCCEEDED")
            .map((refund) => (
              <div
                key={refund.id}
                className="flex justify-between text-purple-700"
              >
                <dt>Refunded {dateFormatter.format(refund.createdAt)}</dt>
                <dd>−{pence(refund.amount)}</dd>
              </div>
            ))}
        </dl>

        {order.status === "PENDING" && (
          <Link
            href={`/checkout/order/${order.orderNumber}`}
            className="mt-8 inline-block rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-700 print:hidden"
          >
            Pay now
          </Link>
        )}
      </article>
    </>
  );
}
