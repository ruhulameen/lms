import type { Metadata } from "next";
import Link from "next/link";
import { removeFromCart } from "@/actions/cart";
import { CouponForm } from "@/components/site/coupon-form";
import { CourseImage } from "@/components/site/course-card";
import { categoryStyle } from "@/lib/category";
import { formatCoursePrice } from "@/lib/course";
import { formatPence } from "@/lib/commerce";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPricedCart } from "@/services/cart";

export const metadata: Metadata = {
  title: "Your cart",
};

export default async function CartPage() {
  const cart = await getPricedCart();

  return (
    <>
      <section className="bg-blue-50 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold text-navy">Your cart</h1>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {cart.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-gray-800">
              Your cart is empty
            </p>
            <p className="mt-1 mb-5 text-sm text-gray-500">
              Add a course to get started.
            </p>
            <Link
              href="/courses"
              className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <ul className="space-y-4 lg:col-span-2">
              {cart.items.map(({ course, pricePence }, index) => {
                const discountPence =
                  cart.pricing.lines[index]?.discountPence ?? 0;
                return (
                  <li
                    key={course.slug}
                    className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row"
                  >
                    <CourseImage
                      course={course}
                      srcWidth={300}
                      width={300}
                      height={200}
                      className="h-32 w-full shrink-0 rounded-lg object-cover sm:h-24 sm:w-32"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "mb-1 text-xs font-bold tracking-wider uppercase",
                          categoryStyle(course.category).text,
                        )}
                      >
                        {course.category}
                      </p>
                      <h2 className="mb-3 text-lg leading-snug font-bold text-navy">
                        <Link
                          href={`/courses/${course.slug}`}
                          className="hover:text-blue-600"
                        >
                          {course.title}
                        </Link>
                      </h2>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="flex items-center gap-4">
                          {discountPence > 0 ? (
                            <span className="flex flex-col items-end">
                              <span className="text-2xl font-extrabold text-navy">
                                {formatCoursePrice(
                                  (pricePence - discountPence) / 100,
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                <span className="line-through">
                                  {formatCoursePrice(pricePence / 100)}
                                </span>{" "}
                                <span className="font-semibold text-green-700">
                                  −{formatPence(discountPence)} coupon
                                </span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-2xl font-extrabold text-navy">
                              {formatCoursePrice(pricePence / 100)}
                            </span>
                          )}
                          <form action={removeFromCart}>
                            <input
                              type="hidden"
                              name="slug"
                              value={course.slug}
                            />
                            <button
                              type="submit"
                              className="text-xs font-bold text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:sticky lg:top-24">
                <div className="border-b border-gray-200 p-6">
                  <h2 className="mb-5 text-xl font-bold text-navy">
                    Order summary
                  </h2>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      Subtotal ({cart.count}{" "}
                      {cart.count === 1 ? "item" : "items"})
                    </span>
                    <span>{formatPrice(cart.subtotal)}</span>
                  </div>
                  {cart.appliedCoupon && (
                    <div className="mt-2 flex justify-between text-sm text-green-700">
                      <span>Coupon ({cart.appliedCoupon.code})</span>
                      <span>
                        −{formatPence(cart.appliedCoupon.discountPence)}
                      </span>
                    </div>
                  )}
                  <div className="mt-4 flex items-baseline justify-between border-t border-gray-200 pt-4">
                    <span className="font-bold text-navy">Total</span>
                    <span className="text-3xl font-extrabold text-blue-600">
                      {formatPrice(cart.total)}
                    </span>
                  </div>
                </div>
                <CouponForm
                  applied={
                    cart.appliedCoupon
                      ? {
                          code: cart.appliedCoupon.code,
                          discount: formatPence(
                            cart.appliedCoupon.discountPence,
                          ),
                        }
                      : null
                  }
                  staleMessage={
                    cart.couponError
                      ? `Coupon ${cart.couponCode}: ${cart.couponError}`
                      : null
                  }
                />
                <div className="p-6">
                  <Link
                    href="/checkout"
                    className="mb-3 block w-full rounded-lg bg-blue-600 py-4 text-center font-bold text-white transition hover:bg-blue-700"
                  >
                    Proceed to checkout →
                  </Link>
                  <Link
                    href="/courses"
                    className="block w-full py-2 text-center text-sm font-semibold text-gray-500 hover:text-blue-600"
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
