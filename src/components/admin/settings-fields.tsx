"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/action-result";
import type { FormState } from "@/lib/form-state";
import type { SettingSource } from "@/lib/settings-schema";
import type { SecretState } from "@/services/settings";

// The pieces the settings screens share: a card, a text field that keeps what
// was typed, a field for keys and passwords, a switch, the save bar and a
// "check it works" button.

export function SettingsCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// Shows the result of a save as a toast, once per submit.
export function useSaveToast(state: FormState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok) toast.error(state.error);
  }, [state]);
}

type TextFieldProps = {
  name: string;
  label: string;
  // The saved value the field starts from.
  saved: string | number;
  state: FormState;
  hint?: string;
  type?: "text" | "email" | "url" | "tel";
  inputMode?: "numeric" | "email" | "url" | "tel";
  placeholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
};

export function TextField({ name, label, saved, state, hint, type = "text", inputMode, placeholder, className, onValueChange }: TextFieldProps) {
  const errors = state.ok ? undefined : state.fieldErrors;
  // Controlled, so a submit (which resets uncontrolled fields) keeps what was typed.
  const [value, setValue] = useState(String(saved ?? ""));
  return (
    <FormField id={`setting-${name}`} label={label} error={errors?.[name]} hint={hint}>
      {(aria) => (
        <Input
          {...aria}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onValueChange?.(e.target.value);
          }}
          autoComplete="off"
          className={className}
        />
      )}
    </FormField>
  );
}

type SecretFieldProps = {
  name: string;
  label: string;
  secret: SecretState;
  state: FormState;
  hint?: string;
  // Where the value in use comes from when none is saved here.
  source?: SettingSource;
  placeholder?: string;
};

// A key or password. The saved value is never shown: the box is empty, typing
// replaces it, leaving it empty keeps it.
export function SecretField({ name, label, secret, state, hint, source, placeholder }: SecretFieldProps) {
  const errors = state.ok ? undefined : state.fieldErrors;
  const status = secret.saved
    ? `Saved: ${secret.hint}. Leave empty to keep it, or type a new one to replace it.`
    : source === "env"
      ? "Not saved here. The one in the server's .env file is being used."
      : "Not set yet.";
  return (
    <FormField id={`setting-${name}`} label={label} error={errors?.[name]} hint={[hint, status].filter(Boolean).join(" ")}>
      {(aria) => (
        <>
          <Input
            {...aria}
            name={name}
            type="password"
            placeholder={secret.saved ? secret.hint : placeholder}
            autoComplete="new-password"
            spellCheck={false}
            className="font-mono"
          />
          {secret.saved && (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name={`${name}Remove`} className="size-3.5 accent-blue-700" />
              Remove the saved value
            </label>
          )}
        </>
      )}
    </FormField>
  );
}

type SwitchFieldProps = {
  name: string;
  label: string;
  description: string;
  saved: boolean;
  state: FormState;
};

export function SwitchField({ name, label, description, saved, state }: SwitchFieldProps) {
  const [on, setOn] = useState(state.values ? state.values[name] === "on" : saved);
  return (
    <div className="flex items-start gap-3">
      <Switch id={`setting-${name}`} checked={on} onCheckedChange={setOn} className="mt-0.5" />
      <input type="hidden" name={name} value={on ? "on" : ""} />
      <div>
        <Label htmlFor={`setting-${name}`}>{label}</Label>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function SaveBar({ pending, state }: { pending: boolean; state: FormState }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save changes"}
      </Button>
      {!state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

// A plain note above a form: what is in use now, or what is missing.
export function Notice({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  const Icon = tone === "ok" ? CircleCheck : CircleAlert;
  return (
    <p
      className={
        tone === "ok"
          ? "flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900"
          : "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

// Runs a check on the saved settings and keeps the answer on the page.
export function CheckButton({ action, label, pendingLabel }: { action: () => Promise<ActionResult>; label: string; pendingLabel: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setResult(null);
              try {
                setResult(await action());
              } catch {
                setResult({ ok: false, error: "The check could not be run. Try again." });
              }
            })
          }
        >
          {pending ? pendingLabel : label}
        </Button>
      </div>
      <div aria-live="polite">
        {result && <Notice tone={result.ok ? "ok" : "warn"}>{result.ok ? result.message : result.error}</Notice>}
      </div>
    </div>
  );
}
