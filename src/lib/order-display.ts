import type { StatusTone } from "@/components/admin/status-badge";
import type { OrderStatusValue } from "@/lib/commerce";
import { currencySymbol } from "@/lib/format";

// How the admin screens show orders. Pure, so client components may import it.
// (A helper that belongs in commerce.ts once stage 2a is done with that file.)

export const orderStatusTones: Record<OrderStatusValue, StatusTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "info",
  PARTIALLY_REFUNDED: "info",
};

// Always two decimals in the admin tables so columns line up: "£49.00".
export const money = (pounds: number) => `${currencySymbol()}${pounds.toFixed(2)}`;

export const cardBrandLabel = (brand: string) => brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();

// "Visa ending 4242", "Free", or "Not paid" for an order with no successful payment.
export function paymentMethodLabel(order: { total: number; payments: { provider: string; status: string; cardBrand: string | null; cardLast4: string | null }[] }) {
  const paid = order.payments.find((p) => p.status === "SUCCEEDED");
  if (paid?.provider === "FREE" || (order.total === 0 && !paid)) return "Free";
  if (!paid) return "Not paid";
  if (paid.cardLast4) return `${paid.cardBrand ? cardBrandLabel(paid.cardBrand) : "Card"} ending ${paid.cardLast4}`;
  return "Card";
}

export const orderEventLabels: Record<string, string> = {
  CREATED: "Order placed",
  PAYMENT_STARTED: "Payment started",
  PAID: "Paid",
  ENROLLED: "Enrolled",
  FAILED: "Payment failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  COUPON_RELEASED: "Coupon use released",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED: "Refunded",
  NOTE: "Staff note",
};

export const ORDER_NOTE_MAX = 2000;
