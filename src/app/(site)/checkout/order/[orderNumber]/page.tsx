import { TrackEvent } from "@/components/site/tracking";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ClearCart } from "@/components/site/clear-cart";
import { PayAgainForm } from "@/components/site/pay-again-form";
import {
  ORDER_NUMBER_PATTERN,
  formatPence,
  isPaidStatus,
  toPence,
} from "@/lib/commerce";
import { loginHref } from "@/lib/return-path";
import { fulfilOrder, getOrderByNumber } from "@/services/order";
import {
  expireOrderIfDue,
  orderPagePath,
  syncOrderWithStripe,
} from "@/services/payment";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

const cardClassName =
  "mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 sm:p-8";
const primaryLink =
  "block w-full rounded-lg bg-blue-600 py-3.5 text-center text-base font-bold text-white transition hover:bg-blue-700";
const secondaryLink =
  "block w-full py-2 text-center text-sm font-semibold text-gray-500 hover:text-blue-600";

// Where the buyer lands after Stripe (and the page of a pending order): the
// state is read from Stripe here, so it is right even if the webhook has not
// arrived (or never does). Only the signed-in owner can open it.
export default async function CheckoutOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; error?: string }>;
}) {
  const { orderNumber } = await params;
  const query = await searchParams;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(loginHref(orderPagePath(orderNumber)));

  let order = await getOrderByNumber(orderNumber, {
    userId: user.id,
    staff: false,
  });
  if (!order) notFound();

  let processing = false;
  if (order.status === "PENDING") {
    if (!(await expireOrderIfDue(order.id)))
      processing = (await syncOrderWithStripe(order.id)).processing;
    order = (await getOrderByNumber(orderNumber, {
      userId: user.id,
      staff: false,
    }))!;
  }
  // A paid order whose enrolments were not written (an earlier step stopped short) is completed now.
  if (
    isPaidStatus(order.status) &&
    order.status !== "REFUNDED" &&
    order.items.some((i) => !i.refundedAt && !i.enrolmentId)
  ) {
    await fulfilOrder(order.id);
    order = (await getOrderByNumber(orderNumber, {
      userId: user.id,
      staff: false,
    }))!;
  }

  const totalPence = toPence(Number(order.total));
  const failure = order.payments.findLast(
    (p) => p.status === "FAILED",
  )?.failureMessage;
  const expired = order.events.some((e) => e.type === "EXPIRED");

  if (isPaidStatus(order.status)) {
    const receiptUrl = order.payments.find(
      (p) => p.status === "SUCCEEDED" && p.receiptUrl,
    )?.receiptUrl;
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <ClearCart orderNumber={order.orderNumber} />
        {/* Only straight after paying, and once per browser: the server reports the sale as well. */}
        {query.paid && totalPence > 0 && (
          <TrackEvent
            once={`purchase-${order.orderNumber}`}
            payload={{
              event: "purchase",
              orderNumber: order.orderNumber,
              value: totalPence / 100,
              coupon: order.couponCode ?? undefined,
              items: order.items.map((item) => ({ id: String(item.courseId), name: item.courseTitle, price: Number(item.total) })),
            }}
          />
        )}
        <div className={cardClassName}>
          <div className="mb-6 text-center">
            <CheckCircle2
              className="mx-auto mb-3 size-12 text-green-600"
              aria-hidden
            />
            <h1 className="text-2xl font-extrabold text-navy">
              Thank you, your order is confirmed
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Order{" "}
              <span className="font-semibold text-gray-800">
                {order.orderNumber}
              </span>
              . A confirmation is on its way to {order.email}.
            </p>
          </div>
          <ul className="mb-6 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {item.courseTitle}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatPence(toPence(Number(item.total)))}
                  </p>
                </div>
                {item.refundedAt ? (
                  <span className="text-xs font-semibold text-gray-500">
                    Refunded
                  </span>
                ) : (
                  <Link
                    href={`/learn/${item.course.slug}`}
                    className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    Start learning
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mb-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="font-bold text-navy">Total paid (inc. VAT)</span>
            <span className="text-xl font-extrabold text-navy">
              {formatPence(totalPence)}
            </span>
          </div>
          <div className="space-y-2">
            {user.panel === "student" && (
              <Link
                href={`/my-orders/${order.orderNumber}`}
                className={primaryLink}
              >
                View receipt
              </Link>
            )}
            {receiptUrl && (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={secondaryLink}
              >
                Stripe payment receipt
              </a>
            )}
            <Link
              href={user.panel === "student" ? "/my-courses" : "/courses"}
              className={secondaryLink}
            >
              {user.panel === "student" ? "Go to my courses" : "Browse courses"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const heading = (
    icon: React.ReactNode,
    title: string,
    text: React.ReactNode,
  ) => (
    <div className="mb-6 text-center">
      {icon}
      <h1 className="text-2xl font-extrabold text-navy">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{text}</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className={cardClassName}>
        {order.status === "PENDING" && processing && (
          <>
            {heading(
              <Clock
                className="mx-auto mb-3 size-12 text-amber-500"
                aria-hidden
              />,
              "We are confirming your payment",
              <>
                Your payment for order{" "}
                <span className="font-semibold text-gray-800">
                  {order.orderNumber}
                </span>{" "}
                has been sent and is not confirmed yet. Some payment methods
                take a while. This page checks again each time you reload it,
                and your courses unlock as soon as the payment is confirmed.
              </>,
            )}
            <Link
              href={orderPagePath(order.orderNumber)}
              className={primaryLink}
            >
              Check again
            </Link>
          </>
        )}

        {order.status === "PENDING" && !processing && (
          <>
            {heading(
              <Clock
                className="mx-auto mb-3 size-12 text-amber-500"
                aria-hidden
              />,
              query.cancelled
                ? "Payment cancelled"
                : "Your order is waiting for payment",
              <>
                Order{" "}
                <span className="font-semibold text-gray-800">
                  {order.orderNumber}
                </span>{" "}
                for {formatPence(totalPence)} has not been paid. It is kept for
                you until{" "}
                {order.expiresAt
                  ? new Intl.DateTimeFormat("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/London",
                    }).format(order.expiresAt)
                  : "a short while"}
                , then the courses go back in your cart.
              </>,
            )}
            {query.error && (
              <p role="alert" className="mb-4 text-center text-sm text-red-600">
                We could not reach the payment provider. Please try again in a
                moment.
              </p>
            )}
            <div className="space-y-2">
              <PayAgainForm
                orderNumber={order.orderNumber}
                label={`Pay ${formatPence(totalPence)}`}
              />
              <Link href="/cart" className={secondaryLink}>
                Back to cart
              </Link>
            </div>
          </>
        )}

        {order.status === "FAILED" && (
          <>
            {heading(
              <XCircle
                className="mx-auto mb-3 size-12 text-red-500"
                aria-hidden
              />,
              "Your payment failed",
              <>
                {failure ?? "The payment did not go through."} You have not been
                charged for order{" "}
                <span className="font-semibold text-gray-800">
                  {order.orderNumber}
                </span>
                . Your courses are still in your cart: check the details or try
                another payment method.
              </>,
            )}
            <div className="space-y-2">
              <Link href="/cart" className={primaryLink}>
                Back to cart
              </Link>
              <Link href="/courses" className={secondaryLink}>
                Continue shopping
              </Link>
            </div>
          </>
        )}

        {order.status === "CANCELLED" && (
          <>
            {heading(
              <XCircle
                className="mx-auto mb-3 size-12 text-gray-400"
                aria-hidden
              />,
              expired ? "This order has expired" : "This order was cancelled",
              <>
                Order{" "}
                <span className="font-semibold text-gray-800">
                  {order.orderNumber}
                </span>{" "}
                was not paid
                {expired ? " in time" : ""} and has been closed. You have not
                been charged. To buy these courses, start again from your cart.
              </>,
            )}
            <div className="space-y-2">
              <Link href="/cart" className={primaryLink}>
                Back to cart
              </Link>
              <Link href="/courses" className={secondaryLink}>
                Continue shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
