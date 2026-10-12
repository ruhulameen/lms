"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { verifyTwoFactor, type AuthState } from "@/actions/auth";
import { AuthField } from "@/components/auth/auth-field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const initialState: AuthState = {};

export function TwoFactorForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(verifyTwoFactor, initialState);
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState("");

  return (
    <form
      action={(formData) => {
        // Codes are single use, so never keep one around after a try.
        setCode("");
        formAction(formData);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="method" value={backup ? "backup" : "totp"} />
      {next && <input type="hidden" name="next" value={next} />}

      {backup ? (
        <AuthField
          key="backup"
          name="code"
          label="Backup code"
          icon={KeyRound}
          autoComplete="one-time-code"
          placeholder="xxxxx-xxxxx"
          hint="Each backup code works once."
          required
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <label
            htmlFor="code"
            className="self-start text-sm font-medium text-gray-600"
          >
            6-digit code
          </label>
          <InputOTP
            id="code"
            name="code"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            value={code}
            onChange={setCode}
            autoFocus
            required
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" name="trustDevice" className="size-4 accent-blue-600" />
        Trust this device for 30 days
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}{" "}
          {state.restart && (
            <Link href="/login" className="font-semibold underline">
              Back to log in
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Verify"}
      </button>

      <button
        type="button"
        onClick={() => {
          setBackup(!backup);
          setCode("");
        }}
        className="w-full rounded text-center text-sm font-semibold text-blue-600 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-blue-600/40"
      >
        {backup ? "Use your authenticator app instead" : "Use a backup code instead"}
      </button>
    </form>
  );
}
