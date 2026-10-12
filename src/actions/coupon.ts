"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { couponFieldsSchema } from "@/lib/coupon-form";
import { formValues, type FormState } from "@/lib/form-state";
import { createCoupon, deleteCoupon, setCouponActive, updateCoupon } from "@/services/coupon-admin";
import { authorizeAction } from "@/services/user";

// Coupon management (coupon.manage). Orders keep the discount they were given
// whatever happens to a coupon afterwards, so editing is always allowed.

const idSchema = z.coerce.number().int().positive();
const NOT_FOUND = "This coupon no longer exists.";

function refresh() {
  revalidatePath("/admin/coupons", "layout");
}

function ids(formData: FormData, name: string) {
  return [...new Set(formData.getAll(name).map((v) => idSchema.safeParse(v)).filter((r) => r.success).map((r) => r.data))];
}

function parse(formData: FormData) {
  const parsed = couponFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false as const,
      state: {
        ok: false,
        error: "Fix the highlighted fields and try again.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        values: formValues(formData),
      } satisfies FormState,
    };
  }
  return { ok: true as const, fields: parsed.data, restrictions: { courseIds: ids(formData, "courseIds"), categoryIds: ids(formData, "categoryIds") } };
}

export async function createCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("coupon.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = parse(formData);
  if (!parsed.ok) return parsed.state;

  const result = await createCoupon(authz.user, parsed.fields, parsed.restrictions);
  if (!result.ok) return { ...result, values: formValues(formData) };
  refresh();
  redirect(`/admin/coupons/${result.id}/edit?created=1`);
}

export async function updateCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("coupon.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: NOT_FOUND, values: formValues(formData) };
  const parsed = parse(formData);
  if (!parsed.ok) return parsed.state;

  const result = await updateCoupon(authz.user, id.data, parsed.fields, parsed.restrictions);
  if (!result.ok) return { ...result, values: formValues(formData) };
  refresh();
  return { ok: true, message: `${result.code} saved.` };
}

export async function setCouponActiveAction(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("coupon.manage");
  if (!authz.ok) return authz.result;
  const id = idSchema.safeParse(formData.get("couponId"));
  if (!id.success) return { ok: false, error: NOT_FOUND };
  const active = formData.get("active") === "true";

  const result = await setCouponActive(authz.user, id.data, active);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: active ? `${result.code} is switched on.` : `${result.code} is switched off.` };
}

export async function deleteCouponAction(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("coupon.manage");
  if (!authz.ok) return authz.result;
  const id = idSchema.safeParse(formData.get("couponId"));
  if (!id.success) return { ok: false, error: NOT_FOUND };

  const result = await deleteCoupon(authz.user, id.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true, message: `${result.code} is deleted.` };
}
