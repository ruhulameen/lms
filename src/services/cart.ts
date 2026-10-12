import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCourseBySlug } from "@/services/course";

// The cart lives in a cookie until orders are stored in the database.
const CART_COOKIE = "cart";
const MAX_QUANTITY = 99;

const cartSchema = z
  .array(
    z.object({
      slug: z.string().min(1).max(120),
      quantity: z.number().int().min(1).max(MAX_QUANTITY),
    }),
  )
  .max(50);

export type CartLine = z.infer<typeof cartSchema>[number];

export async function readCartLines(): Promise<CartLine[]> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
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
  store.set(CART_COOKIE, JSON.stringify(cartSchema.parse(lines)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clampQuantity(quantity: number) {
  return Math.min(Math.max(Math.trunc(quantity) || 1, 1), MAX_QUANTITY);
}

export const getCart = cache(async () => {
  const lines = await readCartLines();
  const items = (
    await Promise.all(
      lines.map(async (line) => {
        const course = await getCourseBySlug(line.slug);
        return course
          ? { course, quantity: line.quantity, total: course.price * line.quantity }
          : null;
      }),
    )
  ).filter((item) => item !== null);

  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.total, 0),
  };
});
