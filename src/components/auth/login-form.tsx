"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";
import { login, type AuthState } from "@/actions/auth";
import { AuthField } from "@/components/auth/auth-field";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {/* Keyed so the field remounts with the submitted email after an error. */}
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
      <AuthField
        name="password"
        label="Password"
        icon={Lock}
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="size-4 accent-blue-600"
        />
        Remember me
      </label>
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
        {pending ? "Logging in…" : "Log In"}
      </button>
    </form>
  );
}
