import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutSteps } from "@/components/site/checkout-steps";
import { formatPrice } from "@/lib/format";
import { getCart } from "@/services/cart";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const cart = await getCart();

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="mb-2 text-2xl font-extrabold text-navy">
          Your order is empty
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Add a course to your cart to start the checkout.
        </p>
        <Link
          href="/courses"
          className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Browse Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <CheckoutSteps>
        <div className="rounded-xl border border-gray-200 bg-white p-6 lg:sticky lg:top-24">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy">Your order</h2>
            <Link
              href="/cart"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Edit cart
            </Link>
          </div>
          <ul className="mb-6 divide-y divide-gray-100">
            {cart.items.map(({ course, quantity, total }) => (
              <li
                key={course.slug}
                className="flex items-start justify-between gap-4 py-3 first:pt-0"
              >
                <div>
                  <p className="mb-1 text-sm leading-snug font-semibold text-gray-800">
                    {course.title}
                  </p>
                  <p className="text-xs text-gray-500">Quantity: {quantity}</p>
                </div>
                <span className="text-sm font-semibold">
                  {formatPrice(total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="text-base font-bold text-navy">
              Total (inc. VAT)
            </span>
            <span className="text-xl font-extrabold text-navy">
              {formatPrice(cart.total)}
            </span>
          </div>
        </div>
      </CheckoutSteps>
    </div>
  );
}
