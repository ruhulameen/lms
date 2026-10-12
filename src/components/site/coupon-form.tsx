"use client";

import { useActionState } from "react";
import { applyCoupon, removeCoupon, type CouponState } from "@/actions/cart";

const initialState: CouponState = {};

type CouponFormProps = {
  // The code in effect, if any.
  applied: { code: string; discount: string } | null;
  // Why the remembered code is no longer applied.
  staleMessage: string | null;
};

export function CouponForm({ applied, staleMessage }: CouponFormProps) {
  const [state, formAction, pending] = useActionState(
    applyCoupon,
    initialState,
  );

  return (
    <div className="border-b border-gray-200 p-6">
      <h3 className="mb-3 text-sm font-bold text-navy">Coupon code</h3>
      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-green-800">
            {applied.code}{" "}
            <span className="font-normal">saves {applied.discount}</span>
          </p>
          <form action={removeCoupon}>
            <button
              type="submit"
              className="text-xs font-bold text-red-500 hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
      ) : (
        <form action={formAction} className="flex gap-2">
          <label htmlFor="coupon-code" className="sr-only">
            Coupon code
          </label>
          <input
            id="coupon-code"
            name="code"
            autoComplete="off"
            maxLength={32}
            placeholder="Enter code"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase outline-none transition placeholder:normal-case focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-navy px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
        </form>
      )}
      {!applied && staleMessage && (
        <p role="status" className="mt-2 text-xs text-amber-700">
          {staleMessage} It is not applied to your total.
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
