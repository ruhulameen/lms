"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { formatPence } from "@/lib/commerce";
import { requestRefund } from "@/services/refund";
import { authorizeAction } from "@/services/user";

const REASON_MAX = 500;

const refundSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  // Comma-separated order line ids, e.g. "12,13".
  itemIds: z
    .string()
    .transform((value) => value.split(",").map((part) => part.trim()).filter(Boolean).map(Number))
    .pipe(z.array(z.number().int().positive()).min(1, "Choose at least one course to refund.").max(100)),
  reason: z
    .string()
    .trim()
    .max(REASON_MAX, `Use at most ${REASON_MAX} characters for the reason.`)
    .transform((value) => value || null),
});

// Refunds the chosen lines of an order (order.refund). Whole-order refunds send
// every line that is not refunded yet.
export async function refundOrderAction(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("order.refund");
  if (!authz.ok) return authz.result;
  const parsed = refundSchema.safeParse({
    orderId: formData.get("orderId"),
    itemIds: formData.get("itemIds") ?? "",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const result = await requestRefund(authz.user, { ...parsed.data, itemIds: [...new Set(parsed.data.itemIds)] });
  revalidatePath("/admin/orders", "layout");
  revalidatePath("/admin");
  revalidatePath("/my-orders", "layout");
  revalidatePath("/my-courses");
  if (!result.ok) return result;
  return {
    ok: true,
    message:
      result.status === "SUCCEEDED"
        ? `Refunded ${formatPence(result.amountPence)} on ${result.orderNumber}.`
        : `Refund of ${formatPence(result.amountPence)} on ${result.orderNumber} sent to Stripe; it will be marked done when Stripe confirms.`,
  };
}
