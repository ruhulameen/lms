"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { refundOrderAction } from "@/actions/refund";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/order-display";
import type { AdminOrder } from "@/services/order-admin";

const REASON_MAX = 500;

// Refund a whole order or chosen courses (order.refund). The amount is what
// each course cost after its coupon share; there is no typed amount. Courses
// in a refund that is still in progress cannot be picked again.
export function OrderRefundControls({ order, canRefund }: { order: AdminOrder; canRefund: boolean }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [reason, setReason] = useState("");

  if (!canRefund || (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED")) return null;

  const held = new Set(order.refunds.filter((r) => r.status === "PENDING").flatMap((r) => r.itemIds));
  const open = order.items.filter((i) => !i.refundedAt && !held.has(i.id));
  if (open.length === 0) {
    return <p className="mb-4 text-sm text-slate-500">Every course on this order is refunded or has a refund in progress.</p>;
  }

  const chosen = open.filter((i) => picked.includes(i.id));
  const amount = Math.round(chosen.reduce((sum, i) => sum + i.total * 100, 0)) / 100;
  const all = chosen.length === open.length;
  const toggle = (id: number, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  // Access an order created is removed; an enrolment that existed before the order stays.
  const kept = chosen.filter((i) => i.enrolment && i.enrolment.status !== "CANCELLED" && i.enrolment.source !== "ORDER");
  const removed = chosen.filter((i) => i.enrolment && i.enrolment.status !== "CANCELLED" && i.enrolment.source === "ORDER");
  const names = (items: typeof chosen) => items.map((i) => i.courseTitle).join(", ");
  const description = [
    `Refund ${money(amount)} for ${names(chosen)}${order.total > 0 ? " to the card that paid for this order" : ""}.`,
    removed.length ? `The learner loses access to ${names(removed)}.` : "No access will be removed.",
    kept.length ? `They keep access to ${names(kept)}, which they were enrolled in before this order.` : null,
    "Certificates already issued are not revoked automatically; do that from Certificates if needed.",
    all ? "This refunds the whole order." : null,
    "The coupon use, if any, is not given back. A refund cannot be undone.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mb-5 rounded-lg border bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">Refund courses</p>
      <ul className="mt-2 grid gap-2">
        <li>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={all} onCheckedChange={(on) => setPicked(on ? open.map((i) => i.id) : [])} />
            <span className="font-medium">Refund whole order</span>
            {open.length < order.items.length && <span className="text-xs text-slate-500">(the courses not yet refunded)</span>}
          </label>
        </li>
        {open.map((item) => (
          <li key={item.id} className="ml-6">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <Checkbox checked={picked.includes(item.id)} onCheckedChange={(on) => toggle(item.id, Boolean(on))} />
              <span>{item.courseTitle}</span>
              <span className="tabular-nums text-slate-600">{money(item.total)}</span>
              {item.enrolment && item.enrolment.status !== "CANCELLED" && item.enrolment.source !== "ORDER" && (
                <span className="text-xs text-slate-500">(enrolled before this order: access stays)</span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <label htmlFor="refund-reason" className="mt-4 block text-sm font-medium">
        Reason (optional)
      </label>
      <Textarea id="refund-reason" rows={2} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
      <p className="mt-1 text-xs text-slate-500">Shown to staff on the timeline.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {chosen.length === 0 ? (
          <span className="text-sm text-slate-500">Tick the courses to refund.</span>
        ) : (
          <>
            <ConfirmDialog
              action={refundOrderAction}
              fields={{ orderId: String(order.id), itemIds: chosen.map((i) => i.id).join(","), reason }}
              title={`Refund ${money(amount)}?`}
              description={description}
              trigger={<><Undo2 aria-hidden /> Refund {money(amount)}</>}
              triggerVariant="destructive"
              confirmLabel={`Refund ${money(amount)}`}
              destructive
            />
            <span className="text-sm text-slate-600">
              {chosen.length} {chosen.length === 1 ? "course" : "courses"}, {money(amount)} will be refunded.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
