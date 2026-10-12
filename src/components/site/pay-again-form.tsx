"use client";

import { useActionState } from "react";
import { payPendingOrder, type PayAgainState } from "@/actions/checkout";

const initialState: PayAgainState = {};

export function PayAgainForm({
  orderNumber,
  label,
}: {
  orderNumber: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    payPendingOrder,
    initialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-green-600 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
      >
        {pending ? "Please wait…" : label}
      </button>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
