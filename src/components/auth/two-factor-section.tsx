"use client";

import { useActionState, useState } from "react";
import { Copy, Download, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorSetup,
  type TwoFactorState,
} from "@/actions/account";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  fieldClassName,
  labelClassName,
  submitClassName,
} from "@/components/student/account-forms";
import { cn } from "@/lib/utils";

const idle: TwoFactorState = { status: "idle" };

const secondaryButton =
  "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 outline-none transition hover:bg-slate-50 focus-visible:ring-3 focus-visible:ring-blue-600/30 disabled:opacity-60";
const dangerButton =
  "rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white outline-none transition hover:bg-red-700 focus-visible:ring-3 focus-visible:ring-red-600/30 disabled:opacity-60";

function ErrorText({ state }: { state: TwoFactorState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {state.message}
    </p>
  );
}

function PasswordField({ id }: { id: string }) {
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        Current password
      </label>
      <input
        id={id}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className={fieldClassName}
      />
    </div>
  );
}

function CodeInput({ id, label }: { id: string; label: string }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <InputOTP
        id={id}
        name="code"
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={value}
        onChange={setValue}
        required
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} className="size-10 text-base" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[];
  // Left out during setup, where the verify form below is the next step.
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lms-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <p
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        Store these backup codes now. They will not be shown again, and each
        one works only once if you lose your authenticator app.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm sm:grid-cols-3">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={cn(secondaryButton, "inline-flex items-center gap-2")}>
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={download} className={cn(secondaryButton, "inline-flex items-center gap-2")}>
          <Download className="size-4" />
          Download
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40"
          >
            I&apos;ve saved them
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({
  enabled,
  justEnabled,
  onDone,
}: {
  enabled: boolean;
  justEnabled: boolean;
  onDone: () => void;
}) {
  const [start, startAction, starting] = useActionState(startTwoFactorSetup, idle);
  const [confirm, confirmAction, confirming] = useActionState(confirmTwoFactorSetup, idle);
  const [regen, regenAction, regenerating] = useActionState(regenerateBackupCodes, idle);
  const [disable, disableAction, disabling] = useActionState(disableTwoFactor, idle);
  const [mode, setMode] = useState<"regenerate" | "disable" | null>(null);

  if (regen.status === "codes" && regen.backupCodes) {
    return <BackupCodes codes={regen.backupCodes} onDone={onDone} />;
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        {justEnabled && (
          <p role="status" className="text-sm font-medium text-green-700">
            Two-factor authentication is on.
          </p>
        )}
        <p className="text-sm text-gray-500">
          Your account asks for a code from your authenticator app when you log in.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode(mode === "regenerate" ? null : "regenerate")} className={secondaryButton} aria-expanded={mode === "regenerate"}>
            New backup codes
          </button>
          <button type="button" onClick={() => setMode(mode === "disable" ? null : "disable")} className={secondaryButton} aria-expanded={mode === "disable"}>
            Turn off
          </button>
        </div>
        {mode === "regenerate" && (
          <form action={regenAction} className="max-w-sm space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-gray-500">
              This replaces your current backup codes. Confirm your password to continue.
            </p>
            <PasswordField id="regen-password" />
            <ErrorText state={regen} />
            <button type="submit" disabled={regenerating} className={submitClassName}>
              {regenerating ? "Generating…" : "Generate new codes"}
            </button>
          </form>
        )}
        {mode === "disable" && (
          <form action={disableAction} className="max-w-sm space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-gray-500">
              Turning this off makes your account protected by your password alone.
            </p>
            <PasswordField id="disable-password" />
            <ErrorText state={disable} />
            <button type="submit" disabled={disabling} className={dangerButton}>
              {disabling ? "Turning off…" : "Turn off two-factor"}
            </button>
          </form>
        )}
      </div>
    );
  }

  if (start.status === "setup") {
    return (
      <div className="space-y-5">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy).</li>
          <li>Save the backup codes below.</li>
          <li>Enter the 6-digit code the app shows to finish.</li>
        </ol>
        <div className="flex flex-wrap items-start gap-6">
          {/* A data URL rendered on the server; no browser request is made. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={start.qr} alt="QR code for your authenticator app" width={192} height={192} className="rounded-lg border border-slate-200" />
          <div className="min-w-0 space-y-1">
            <p className={labelClassName}>Can&apos;t scan? Enter this key</p>
            <code className="block max-w-full rounded bg-slate-50 px-3 py-2 font-mono text-sm break-all select-all">
              {start.secret}
            </code>
          </div>
        </div>
        {start.backupCodes && <BackupCodes codes={start.backupCodes} />}
        <form action={confirmAction} className="max-w-sm space-y-3">
          <CodeInput id="setup-code" label="Verification code" />
          <ErrorText state={confirm} />
          <button type="submit" disabled={confirming} className={submitClassName}>
            {confirming ? "Verifying…" : "Verify and turn on"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={startAction} className="max-w-sm space-y-3">
      {disable.status === "disabled" && (
        <p role="status" className="text-sm font-medium text-green-700">
          {disable.message}
        </p>
      )}
      <p className="text-sm text-gray-500">
        Protect your account with a code from an authenticator app. Confirm your password to begin.
      </p>
      <PasswordField id="enable-password" />
      <ErrorText state={start} />
      <button type="submit" disabled={starting} className={submitClassName}>
        {starting ? "Starting…" : "Set up two-factor"}
      </button>
    </form>
  );
}

export function TwoFactorSection({
  enabled,
  justEnabled = false,
}: {
  enabled: boolean;
  justEnabled?: boolean;
}) {
  const [epoch, setEpoch] = useState(0);

  return (
    <section className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <ShieldCheck className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-navy">Two-factor authentication</h2>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
              enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600",
            )}
          >
            {enabled ? "On" : "Off"}
          </span>
        </div>
        {/* Remounting after the codes are saved clears the one-time setup state. */}
        <Panel key={epoch} enabled={enabled} justEnabled={justEnabled} onDone={() => setEpoch((value) => value + 1)} />
      </div>
    </section>
  );
}
