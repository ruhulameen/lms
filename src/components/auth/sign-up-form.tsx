"use client";

import { useActionState } from "react";
import { Lock, Mail, ShieldCheck, User } from "lucide-react";
import { signUp, type AuthState } from "@/actions/auth";
import { AuthField } from "@/components/auth/auth-field";

const initialState: AuthState = {};

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <AuthField
        key={`name-${state.name}`}
        name="name"
        label="Full name"
        icon={User}
        autoComplete="name"
        placeholder="John Smith"
        defaultValue={state.name}
        required
      />
      <AuthField
        key={`email-${state.email}`}
        name="email"
        label="Email address"
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={state.email}
        required
      />
      <AuthField
        name="password"
        label="Password"
        icon={Lock}
        type="password"
        autoComplete="new-password"
        placeholder="Create a password"
        hint="Must be at least 8 characters"
        minLength={8}
        required
      />
      <AuthField
        name="confirmPassword"
        label="Confirm password"
        icon={ShieldCheck}
        type="password"
        autoComplete="new-password"
        placeholder="Confirm your password"
        minLength={8}
        required
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}
