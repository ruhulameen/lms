import { Ban, CircleCheck, CircleX, Clock, Undo2 } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { orderStatusLabels, type OrderStatusValue } from "@/lib/commerce";
import { orderStatusTones } from "@/lib/order-display";

const icons = {
  PENDING: Clock,
  PAID: CircleCheck,
  FAILED: CircleX,
  CANCELLED: Ban,
  REFUNDED: Undo2,
  PARTIALLY_REFUNDED: Undo2,
} as const;

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  return <StatusBadge label={orderStatusLabels[status]} tone={orderStatusTones[status]} icon={icons[status]} />;
}
