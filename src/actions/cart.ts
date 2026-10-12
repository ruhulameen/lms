"use server";

import { redirect } from "next/navigation";
import {
  clampQuantity,
  readCartLines,
  writeCartLines,
} from "@/services/cart";
import { getCourseBySlug } from "@/services/course";

async function add(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  // Only courses that exist can be added.
  if (!(await getCourseBySlug(slug))) return;

  const lines = await readCartLines();
  const line = lines.find((item) => item.slug === slug);
  if (line) line.quantity = clampQuantity(line.quantity + 1);
  else lines.push({ slug, quantity: 1 });
  await writeCartLines(lines);
}

export async function addToCart(formData: FormData) {
  await add(formData);
  redirect("/cart");
}

export async function buyNow(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const lines = await readCartLines();
  if (!lines.some((item) => item.slug === slug)) await add(formData);
  redirect("/checkout");
}

export async function updateCartQuantity(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const quantity = clampQuantity(Number(formData.get("quantity")));
  const lines = await readCartLines();
  await writeCartLines(
    lines.map((item) => (item.slug === slug ? { ...item, quantity } : item)),
  );
}

export async function removeFromCart(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const lines = await readCartLines();
  await writeCartLines(lines.filter((item) => item.slug !== slug));
}
