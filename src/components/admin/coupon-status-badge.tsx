import { StatusBadge } from "@/components/admin/status-badge";
import { couponStateMeta, type CouponState } from "@/lib/coupon-form";

export function CouponStatusBadge({ state }: { state: CouponState }) {
  const meta = couponStateMeta[state];
  return <StatusBadge label={meta.label} tone={meta.tone} />;
}
