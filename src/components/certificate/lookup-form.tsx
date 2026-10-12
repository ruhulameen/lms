"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { lookupCertificate } from "@/actions/certificate";
import { initialFormState } from "@/lib/form-state";

export function LookupForm() {
  const [state, formAction, pending] = useActionState(lookupCertificate, initialFormState);
  const error = state.ok ? null : state.error;
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <label htmlFor="certificate-code" className="block text-sm font-bold text-navy">
        Certificate ID
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="certificate-code"
          name="code"
          defaultValue={state.values?.code ?? ""}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="LMS-ABCD-2345-WXYZ"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "certificate-code-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm tracking-wider uppercase outline-none focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:opacity-60"
        >
          <Search className="size-4" aria-hidden /> {pending ? "Checking…" : "Verify"}
        </button>
      </div>
      {error && (
        <p id="certificate-code-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
