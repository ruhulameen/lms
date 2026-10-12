import { orderStatusLabels, type OrderStatusValue } from "@/lib/commerce";
import { cn } from "@/lib/utils";

const styles: Record<OrderStatusValue, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
  REFUNDED: "bg-purple-50 text-purple-700",
  PARTIALLY_REFUNDED: "bg-purple-50 text-purple-700",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatusValue;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-[11px] font-bold",
        styles[status],
        className,
      )}
    >
      {orderStatusLabels[status]}
    </span>
  );
}
