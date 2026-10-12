import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { OrderStatusBadge } from "@/components/student/order-status-badge";
import { PageHeading } from "@/components/student/page-heading";
import { formatPence, toPence } from "@/lib/commerce";
import { listOrdersForUser } from "@/services/order";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "My Orders",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function MyOrdersPage() {
  const user = await requireUser();
  const orders = await listOrdersForUser(user.id);

  return (
    <>
      <PageHeading
        title="My Orders"
        description={
          orders.length === 1 ? "1 order." : `${orders.length} orders.`
        }
      />

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Receipt className="size-7" aria-hidden />
          </span>
          <h2 className="mb-2 text-lg font-bold text-navy">No orders yet</h2>
          <p className="mb-5 text-sm text-gray-500">
            Courses you buy will be listed here with a receipt for each.
          </p>
          <Link
            href="/courses"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-navy">
                    {order.orderNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dateFormatter.format(order.createdAt)}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <ul className="my-3 space-y-1 text-sm text-gray-700">
                {order.items.map((item) => (
                  <li key={item.id}>{item.courseTitle}</li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-lg font-extrabold text-navy">
                  {formatPence(toPence(Number(order.total)))}
                </span>
                <div className="flex gap-4 text-xs font-bold">
                  {order.status === "PENDING" && (
                    <Link
                      href={`/checkout/order/${order.orderNumber}`}
                      className="text-green-700 hover:underline"
                    >
                      Pay now
                    </Link>
                  )}
                  <Link
                    href={`/my-orders/${order.orderNumber}`}
                    className="text-blue-600 hover:underline"
                  >
                    {order.status === "PENDING" ? "Details" : "Receipt"}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
