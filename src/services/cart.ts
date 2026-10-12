import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { isSellable, priceOrder, toPence, type PricedLine } from "@/lib/commerce";
import { hasLearnerAccess } from "@/lib/learning";
import { evaluateCoupon } from "@/services/coupon";
import { getCourseBySlug } from "@/services/course";
import { getCurrentUser } from "@/services/user";

// The cart lives in a cookie: the slugs of the courses to buy, one of each (no
// quantities). Whatever has since become unbuyable (free, unpublished, already
// owned) is dropped when the cart is read.
const CART_COOKIE = "cart";

// Older cookies stored { slug, quantity }; zod strips the extra key, and a
// repeated slug is collapsed below.
const cartSchema = z
  .array(z.object({ slug: z.string().min(1).max(120) }))
  .max(50);

export type CartLine = z.infer<typeof cartSchema>[number];

export async function readCartLines(): Promise<CartLine[]> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const seen = new Set<string>();
    return parsed.data.filter((line) => !seen.has(line.slug) && seen.add(line.slug));
  } catch {
    return [];
  }
}

// Only callable from a server action: cookies can't be set while rendering.
export async function writeCartLines(lines: CartLine[]) {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, JSON.stringify(cartSchema.parse(lines.map((l) => ({ slug: l.slug })))), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export type CartCheck =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "free" | "owned" };

// Whether a course may go in the cart for this learner (null when signed out):
// it must be publicly visible and cost something, and the learner must not
// already have it (an active or completed enrolment).
export async function checkCartable(slug: string, userId: number | null): Promise<CartCheck> {
  const course = await getCourseBySlug(slug);
  if (!course) return { ok: false, reason: "unavailable" };
  if (!isSellable(toPence(course.price))) return { ok: false, reason: "free" };
  if (userId !== null) {
    const enrolment = await db.enrolment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { status: true },
    });
    if (enrolment && hasLearnerAccess(enrolment.status)) return { ok: false, reason: "owned" };
  }
  return { ok: true };
}

// The cart as shown and priced. `lines` is the shape the coupon rules take
// (see PricedLine in src/lib/commerce.ts), parallel to `items`.
export const getCart = cache(async () => {
  const slugs = (await readCartLines()).map((line) => line.slug);
  const user = await getCurrentUser();

  const courses = (await Promise.all(slugs.map((slug) => getCourseBySlug(slug)))).filter((c) => c !== null);
  const owned = user && courses.length
    ? await db.enrolment.findMany({
        where: { userId: user.id, courseId: { in: courses.map((c) => c.id) } },
        select: { courseId: true, status: true },
      })
    : [];
  const ownedIds = new Set(owned.filter((e) => hasLearnerAccess(e.status)).map((e) => e.courseId));

  const items = courses
    .filter((course) => isSellable(toPence(course.price)) && !ownedIds.has(course.id))
    .map((course) => ({ course, pricePence: toPence(course.price) }));
  const lines: PricedLine[] = items.map(({ course, pricePence }) => ({
    courseId: course.id,
    categoryId: course.categoryId,
    pricePence,
  }));
  const subtotalPence = lines.reduce((sum, line) => sum + line.pricePence, 0);

  return {
    items,
    lines,
    count: items.length,
    subtotalPence,
    // Pounds, for display with formatPrice().
    subtotal: subtotalPence / 100,
  };
});

// ---------------------------------------------------------------- coupon

// The applied coupon code is remembered next to the cart and evaluated again
// on every render, so a code that stops being valid is simply not applied.
const COUPON_COOKIE = "coupon";

export async function readCouponCode(): Promise<string | null> {
  const raw = (await cookies()).get(COUPON_COOKIE)?.value;
  return raw && raw.length <= 64 ? raw : null;
}

// Only callable from a server action.
export async function writeCouponCode(code: string | null) {
  const store = await cookies();
  if (!code) {
    store.delete(COUPON_COOKIE);
    return;
  }
  store.set(COUPON_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// The cart with the coupon applied. `pricing.lines` is parallel to `items`.
// A code that no longer works is left out and `couponError` says why.
export const getPricedCart = cache(async () => {
  const cart = await getCart();
  const code = cart.lines.length ? await readCouponCode() : null;
  const evaluated = code ? await evaluateCoupon(await getCurrentUser(), cart.lines, code, { ignoreOwnPending: true }) : null;
  const good = evaluated?.ok ? evaluated : null;
  const applied = good ? { code: good.code, couponId: good.couponId, discountPence: good.discountPence } : null;
  const couponError = evaluated && !evaluated.ok ? evaluated.message : null;
  const pricing = good ? good.pricing : priceOrder(cart.lines);
  return {
    ...cart,
    couponCode: code,
    appliedCoupon: applied,
    couponError,
    pricing,
    totalPence: pricing.totalPence,
    // Pounds, for display with formatPrice().
    total: pricing.totalPence / 100,
  };
});
