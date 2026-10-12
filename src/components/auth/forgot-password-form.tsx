"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { forgotPassword, type AuthState } from "@/actions/auth";
import { AuthField } from "@/components/auth/auth-field";

const initialState: AuthState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <AuthField
        key={state.email}
        name="email"
        label="Email address"
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={state.email}
        required
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800"
        >
          {state.notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
