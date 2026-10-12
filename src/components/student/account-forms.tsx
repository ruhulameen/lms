"use client";

import { useActionState } from "react";
import {
  type AccountState,
  changePassword,
  updateProfile,
} from "@/actions/account";
import { cn } from "@/lib/utils";

const initialState: AccountState = { status: "idle" };

export const fieldClassName =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10 read-only:bg-slate-50 read-only:text-gray-500";
export const labelClassName =
  "mb-2 block text-xs font-bold tracking-wider text-gray-500 uppercase";
export const submitClassName =
  "w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60";

export function Feedback({ state }: { state: AccountState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        state.status === "error" ? "text-red-600" : "text-green-700",
      )}
    >
      {state.message}
    </p>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className={labelClassName}>
          Full name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          autoComplete="name"
          required
          minLength={2}
          className={fieldClassName}
        />
      </div>
      <div>
        <label htmlFor="email" className={labelClassName}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          aria-describedby="email-hint"
          className={fieldClassName}
        />
        <p id="email-hint" className="mt-1.5 text-xs text-gray-500">
          Changing your email isn&apos;t available yet.
        </p>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="currentPassword" className={labelClassName}>
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClassName}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="newPassword" className={labelClassName}>
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={fieldClassName}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className={labelClassName}>
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={fieldClassName}
          />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
