import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

type FormFieldProps = {
  id: string;
  label: string;
  // Messages for this field from the action result.
  error?: string[];
  hint?: string;
  children: (aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

// Label + control + hint + field-level error, wired together for screen readers.
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  const message = error?.[0];
  const describedBy = [hint && `${id}-hint`, message && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": Boolean(message),
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

export const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50";
