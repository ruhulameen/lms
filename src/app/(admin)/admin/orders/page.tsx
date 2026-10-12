import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/activity-details";
import { orderStatuses, orderStatusLabels } from "@/lib/commerce";
import { formatDateInput, parseDateInput } from "@/lib/date-range";
import { money, paymentMethodLabel } from "@/lib/order-display";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { ORDER_SORT_KEYS, listOrders, type OrderRow } from "@/services/order-admin";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Orders" };

const PATH = "/admin/orders";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("order.view");
  const params = await searchParams;

  const status = orderStatuses.find((s) => s === firstParam(params.status));
  const from = parseDateInput(firstParam(params.from));
  const toDay = parseDateInput(firstParam(params.to));
  const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1) : undefined;
  const userId = intParam(params.user, 0) || undefined;
  const couponId = intParam(params.coupon, 0) || undefined;
  const sort = sortParams(params, ORDER_SORT_KEYS, { sort: "date", order: "desc" });
  const list = await listOrders({ search: firstParam(params.q), status, userId, couponId, from, to, page: intParam(params.page), ...sort });
  const { summary } = list;

  const columns: DataTableColumn<OrderRow>[] = [
    {
      key: "number",
      header: "Order",
      sortable: true,
      cell: (o) => (
        <Link href={`${PATH}/${o.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
          {o.orderNumber}
        </Link>
      ),
    },
    { key: "date", header: "Date", sortable: true, cell: (o) => formatDate(o.createdAt) },
    {
      key: "learner",
      header: "Learner",
      sortable: true,
      cell: (o) => (
        <div className="min-w-0">
          <span className="font-medium">{o.learner.name}</span>
          <p className="truncate text-xs text-slate-500">{o.learner.email}</p>
        </div>
      ),
    },
    {
      key: "courses",
      header: "Courses",
      cell: (o) => (
        <span title={o.courses.join(", ")}>
          {o.courses[0] ?? "-"}
          {o.courses.length > 1 && <span className="ml-1 text-xs text-slate-500">+{o.courses.length - 1}</span>}
        </span>
      ),
    },
    {
      key: "coupon",
      header: "Coupon",
      cell: (o) => (o.couponCode ? <span className="font-mono text-xs">{o.couponCode}</span> : <span className="text-slate-400">None</span>),
    },
    { key: "total", header: "Total", sortable: true, className: "text-right tabular-nums", cell: (o) => money(o.total) },
    { key: "status", header: "Status", sortable: true, cell: (o) => <OrderStatusBadge status={o.status} /> },
    { key: "payment", header: "Payment", cell: (o) => <span className="text-sm">{paymentMethodLabel(o)}</span> },
  ];

  return (
    <>
      <PageHeader title="Orders" description="Course purchases, their payments and refunds." />
      <dl className="mb-4 grid gap-3 sm:grid-cols-3" aria-label="Summary of the orders below">
        <Stat label={summary.orders === 1 ? "Order" : "Orders"} value={String(summary.orders)} />
        <Stat label={`Paid (${summary.paidOrders} ${summary.paidOrders === 1 ? "order" : "orders"}, before refunds)`} value={money(summary.paidTotal)} />
        <Stat label="Refunded" value={money(summary.refundedTotal)} />
      </dl>
      <DataTable
        caption="Orders"
        columns={columns}
        rows={list.rows}
        rowKey={(o) => o.id}
        basePath={PATH}
        searchParams={params}
        sort={sort}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        emptyTitle="No orders found"
        emptyDescription="Orders appear here when learners check out. Try a different search or clear the filters."
        toolbar={
          <DataTableToolbar basePath={PATH} searchParams={params} keepParams={["user", "coupon"]} searchPlaceholder="Search order, learner or course">
            <FilterSelect
              name="status"
              label="All statuses"
              searchParams={params}
              options={orderStatuses.map((s) => ({ value: s, label: orderStatusLabels[s] }))}
            />
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              From
              <Input type="date" name="from" defaultValue={from ? formatDateInput(from) : ""} className="w-36" />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              To
              <Input type="date" name="to" defaultValue={toDay ? formatDateInput(toDay) : ""} className="w-36" />
            </label>
          </DataTableToolbar>
        }
      />
    </>
  );
}
