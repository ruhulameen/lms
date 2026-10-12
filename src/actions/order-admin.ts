"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { formValues, type FormState } from "@/lib/form-state";
import { ORDER_NOTE_MAX } from "@/lib/order-display";
import { addOrderNote, cancelPendingOrder } from "@/services/order-admin";
import { authorizeAction } from "@/services/user";

// Staff actions on an order (order.manage). Refunds are separate (order.refund).

const idSchema = z.coerce.number().int().positive();
const NOT_FOUND = "This order no longer exists.";

function refresh(orderId: number) {
  revalidatePath("/admin/orders", "layout");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/coupons", "layout");
  revalidatePath("/admin");
}

const noteSchema = z.string().trim().min(1, "Write a note.").max(ORDER_NOTE_MAX, `Use at most ${ORDER_NOTE_MAX} characters.`);

export async function addOrderNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("order.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const id = idSchema.safeParse(formData.get("orderId"));
  if (!id.success) return { ok: false, error: NOT_FOUND };
  const note = noteSchema.safeParse(formData.get("note"));
  if (!note.success) {
    const message = note.error.issues[0].message;
    return { ok: false, error: message, fieldErrors: { note: [message] }, values: formValues(formData) };
  }

  const result = await addOrderNote(authz.user, id.data, note.data);
  if (!result.ok) return { ok: false, error: result.error, values: formValues(formData) };
  refresh(id.data);
  return { ok: true, message: "Note added." };
}

export async function cancelOrderAction(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("order.manage");
  if (!authz.ok) return authz.result;
  const id = idSchema.safeParse(formData.get("orderId"));
  if (!id.success) return { ok: false, error: NOT_FOUND };

  const result = await cancelPendingOrder(authz.user, id.data);
  if (!result.ok) return result;
  refresh(id.data);
  return { ok: true, message: `Order ${result.orderNumber} is cancelled.` };
}
