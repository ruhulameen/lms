"use client";

import { useActionState } from "react";
import { MailWarning } from "lucide-react";
import { resendVerification, type AuthState } from "@/actions/auth";

const initialState: AuthState = {};

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resendVerification, initialState);

  return (
    <div
      role="region"
      aria-label="Verify your email"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <MailWarning className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Verify your email.</span> We sent a
        link to {email}.
        {state.notice && (
          <span role="status" className="ml-1 font-medium text-green-800">
            {state.notice}
          </span>
        )}
        {state.error && (
          <span role="alert" className="ml-1 font-medium text-red-700">
            {state.error}
          </span>
        )}
      </p>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 outline-none transition hover:bg-amber-100 focus-visible:ring-3 focus-visible:ring-amber-500/40 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Resend link"}
        </button>
      </form>
    </div>
  );
}
