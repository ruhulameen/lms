"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { resetPassword, type AuthState } from "@/actions/auth";
import { AuthField } from "@/components/auth/auth-field";

const initialState: AuthState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <AuthField
        name="password"
        label="New password"
        icon={Lock}
        type="password"
        autoComplete="new-password"
        placeholder="Create a new password"
        hint="Must be at least 8 characters"
        minLength={8}
        maxLength={128}
        required
      />
      <AuthField
        name="confirmPassword"
        label="Confirm new password"
        icon={ShieldCheck}
        type="password"
        autoComplete="new-password"
        placeholder="Confirm your new password"
        minLength={8}
        maxLength={128}
        required
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}{" "}
          {state.restart && (
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Reset password"}
      </button>
    </form>
  );
}
