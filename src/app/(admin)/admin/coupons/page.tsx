import type { Metadata } from "next";
import Link from "next/link";
import { CirclePlus, Copy, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { deleteCouponAction, setCouponActiveAction } from "@/actions/coupon";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { CouponStatusBadge } from "@/components/admin/coupon-status-badge";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/activity-details";
import { couponStateMeta, couponStates, discountLabel, plural, restrictionSummary } from "@/lib/coupon-form";
import { money } from "@/lib/order-display";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { COUPON_SORT_KEYS, listCoupons, type CouponRow } from "@/services/coupon-admin";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Coupons" };

const PATH = "/admin/coupons";

export default async function CouponsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("coupon.view");
  const params = await searchParams;
  const canManage = can(viewer, "coupon.manage");

  const state = couponStates.find((s) => s === firstParam(params.status));
  const sort = sortParams(params, COUPON_SORT_KEYS, { sort: "created", order: "desc" });
  const list = await listCoupons({ search: firstParam(params.q), state, page: intParam(params.page), ...sort });

  const columns: DataTableColumn<CouponRow>[] = [
    {
      key: "code",
      header: "Code",
      sortable: true,
      cell: (c) => (
        <div className="min-w-0">
          <Link href={`${PATH}/${c.id}/edit`} className="font-mono text-sm font-medium text-blue-700 hover:underline">
            {c.code}
          </Link>
          {c.description && <p className="max-w-56 truncate text-xs text-slate-500">{c.description}</p>}
        </div>
      ),
    },
    {
      key: "discount",
      header: "Discount",
      sortable: true,
      cell: (c) => (
        <span>
          {discountLabel(c.discountType, c.value)}
          {c.minSpend !== null && <span className="block text-xs text-slate-500">Min spend {money(c.minSpend)}</span>}
        </span>
      ),
    },
    {
      key: "applies",
      header: "Applies to",
      cell: (c) => (
        <span>
          {restrictionSummary(c.courseCount, c.categoryCount)}
          {c.userCount > 0 && <span className="block text-xs text-slate-500">Personal: {plural(c.userCount, "learner")}</span>}
        </span>
      ),
    },
    {
      key: "limits",
      header: "Limits",
      cell: (c) =>
        c.usageLimit === null && c.perUserLimit === null ? (
          <span className="text-slate-400">None</span>
        ) : (
          <span className="text-sm">
            {c.usageLimit !== null && <span className="block">{plural(c.usageLimit, "use")} in total</span>}
            {c.perUserLimit !== null && <span className="block text-xs text-slate-500">{plural(c.perUserLimit, "use")} per learner</span>}
          </span>
        ),
    },
    {
      key: "expires",
      header: "Dates",
      sortable: true,
      cell: (c) =>
        c.startsAt === null && c.expiresAt === null ? (
          <span className="text-slate-400">Always</span>
        ) : (
          <span className="text-xs">
            {c.startsAt && <span className="block">From {formatDateTime(c.startsAt)}</span>}
            {c.expiresAt && <span className="block">Until {formatDateTime(c.expiresAt)}</span>}
          </span>
        ),
    },
    {
      key: "uses",
      header: "Uses",
      sortable: true,
      cell: (c) => (
        <span className="tabular-nums">
          {c.uses}
          {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (c) => <CouponStatusBadge state={c.state} /> },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: "Actions",
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" render={<Link href={`${PATH}/${c.id}/edit`} />}>
            <Pencil aria-hidden /> Edit
          </Button>
          <ConfirmDialog
            action={setCouponActiveAction}
            fields={{ couponId: String(c.id), active: String(!c.active) }}
            title={c.active ? `Switch off ${c.code}?` : `Switch on ${c.code}?`}
            description={
              c.active
                ? "Learners will be told the coupon is not active. Orders already placed with it are not affected."
                : "Learners can use the coupon again, within its dates and limits."
            }
            trigger={c.active ? <><PowerOff aria-hidden /> Switch off</> : <><Power aria-hidden /> Switch on</>}
            confirmLabel={c.active ? "Switch off" : "Switch on"}
          />
          <Button variant="outline" size="sm" render={<Link href={`${PATH}/new?from=${c.id}`} />}>
            <Copy aria-hidden /> Duplicate
          </Button>
          {c.redemptions > 0 ? (
            <ConfirmDialog
              action={setCouponActiveAction}
              fields={{ couponId: String(c.id), active: "false" }}
              title={`${c.code} cannot be deleted`}
              description={`It has been used ${plural(c.redemptions, "time")} and those orders refer to it, so it has to stay. Switch it off instead: nobody can use it, and the orders and totals are kept.`}
              trigger={<><Trash2 aria-hidden /> Delete</>}
              triggerVariant="outline"
              confirmLabel={c.active ? "Switch it off" : "Already off"}
            />
          ) : (
            <ConfirmDialog
              action={deleteCouponAction}
              fields={{ couponId: String(c.id) }}
              title={`Delete ${c.code}?`}
              description="This coupon has never been used. Deleting it cannot be undone."
              trigger={<><Trash2 aria-hidden /> Delete</>}
              triggerVariant="destructive"
              confirmLabel="Delete coupon"
              destructive
            />
          )}
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes learners type at checkout."
        actions={
          canManage && (
            <Button render={<Link href={`${PATH}/new`} />}>
              <CirclePlus aria-hidden /> Add coupon
            </Button>
          )
        }
      />
      <DataTable
        caption="Coupons"
        columns={columns}
        rows={list.rows}
        rowKey={(c) => c.id}
        basePath={PATH}
        searchParams={params}
        sort={sort}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        emptyTitle="No coupons found"
        emptyDescription="Try a different search or clear the filter."
        toolbar={
          <DataTableToolbar basePath={PATH} searchParams={params} searchPlaceholder="Search code or description">
            <FilterSelect name="status" label="All coupons" searchParams={params} options={couponStates.map((s) => ({ value: s, label: couponStateMeta[s].label }))} />
          </DataTableToolbar>
        }
      />
    </>
  );
}
