"use server";

import { redirect } from "next/navigation";
import { normaliseCouponCode } from "@/lib/commerce";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkCartable, getCart, readCartLines, writeCartLines, writeCouponCode } from "@/services/cart";
import { evaluateCoupon } from "@/services/coupon";
import { getCurrentUser } from "@/services/user";

// Adds the course to the cart when it can be bought; otherwise redirects to
// where the learner can do something useful instead: a free course to its page
// (to enrol), one they already own to the player, one that is gone to the
// catalogue. Returns after adding.
async function add(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const user = await getCurrentUser();
  const check = await checkCartable(slug, user?.id ?? null);
  if (!check.ok) {
    if (check.reason === "free") redirect(`/courses/${encodeURIComponent(slug)}`);
    if (check.reason === "owned") redirect(`/learn/${encodeURIComponent(slug)}`);
    redirect("/courses");
  }

  const lines = await readCartLines();
  if (!lines.some((item) => item.slug === slug)) {
    lines.push({ slug });
    await writeCartLines(lines);
  }
}

export async function addToCart(formData: FormData) {
  await add(formData);
  redirect("/cart");
}

export async function buyNow(formData: FormData) {
  await add(formData);
  redirect("/checkout");
}

export async function removeFromCart(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const lines = await readCartLines();
  await writeCartLines(lines.filter((item) => item.slug !== slug));
}

export type CouponState = { error?: string; notice?: string };

// Tries a code on the cart. Signed-out visitors may try one too; the
// per-learner limit is checked again when the order is placed.
export async function applyCoupon(_prev: CouponState, formData: FormData): Promise<CouponState> {
  const user = await getCurrentUser();
  const limited = await checkRateLimit("coupon", [
    { scope: "ip", limit: 20, windowSeconds: 15 * 60 },
    ...(user ? [{ scope: "user" as const, value: user.id, limit: 20, windowSeconds: 15 * 60 }] : []),
  ]);
  if (limited) return { error: limited };

  const code = normaliseCouponCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "Enter a valid coupon code." };

  const cart = await getCart();
  if (cart.lines.length === 0) return { error: "Add a course to your cart first." };

  const result = await evaluateCoupon(user, cart.lines, code, { ignoreOwnPending: true });
  if (!result.ok) return { error: result.message };
  await writeCouponCode(result.code);
  return { notice: `Coupon ${result.code} applied.` };
}

export async function removeCoupon() {
  await writeCouponCode(null);
}
