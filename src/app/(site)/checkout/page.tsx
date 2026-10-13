import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutSteps } from "@/components/site/checkout-steps";
import { TrackEvent } from "@/components/site/tracking";
import { formatPence, isFreeOrder } from "@/lib/commerce";
import { formatCoursePrice } from "@/lib/course";
import { formatPrice } from "@/lib/format";
import { canTakePayments } from "@/lib/stripe";
import { loginHref } from "@/lib/return-path";
import { getPricedCart } from "@/services/cart";
import { getBillingDefaults } from "@/services/checkout";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const cart = await getPricedCart();

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

  // Only signed-in learners check out; login and sign-up bring them back here.
  const user = await getCurrentUser();
  if (!user) redirect(loginHref("/checkout"));

  const free = isFreeOrder(cart.totalPence);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <TrackEvent
        payload={{
          event: "begin_checkout",
          value: cart.total,
          coupon: cart.couponCode ?? undefined,
          items: cart.items.map(({ course }, i) => ({ id: String(cart.lines[i].courseId), name: course.title, price: cart.pricing.lines[i].totalPence / 100 })),
        }}
      />
      <CheckoutSteps
        defaults={await getBillingDefaults(user)}
        email={user.email}
        payLabel={
          free ? "Complete order" : `Pay ${formatPence(cart.totalPence)}`
        }
        canPay={free || canTakePayments()}
        notice={
          cart.couponError
            ? `Coupon ${cart.couponCode}: ${cart.couponError} It is not applied to your total.`
            : null
        }
      >
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
            {cart.items.map(({ course }, index) => {
              const line = cart.pricing.lines[index];
              return (
                <li
                  key={course.slug}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0"
                >
                  <div>
                    <p className="mb-1 text-sm leading-snug font-semibold text-gray-800">
                      {course.title}
                    </p>
                  </div>
                  <span className="text-right text-sm font-semibold">
                    {formatCoursePrice(line.totalPence / 100)}
                    {line.discountPence > 0 && (
                      <span className="block text-xs font-normal text-gray-400 line-through">
                        {formatCoursePrice(line.pricePence / 100)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {cart.appliedCoupon && (
            <div className="mb-3 flex justify-between text-sm text-green-700">
              <span>Coupon ({cart.appliedCoupon.code})</span>
              <span>−{formatPence(cart.appliedCoupon.discountPence)}</span>
            </div>
          )}
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
