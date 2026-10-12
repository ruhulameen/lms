"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { getDownloadLink } from "@/actions/learning";
import { cn } from "@/lib/utils";

// Asks the server for a fresh signed link when pressed (download links last
// only minutes, so one made at page load would often be dead).
export function DownloadButton({
  kind,
  id,
  label = "Download",
  className,
}: {
  kind: "lesson" | "resource";
  id: number;
  label?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await getDownloadLink({ kind, id });
            if (result.ok) window.location.assign(result.data.url);
            else setError(result.error);
          })
        }
        className={cn(
          "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40 disabled:opacity-60",
          className,
        )}
      >
        <Download className="size-4" aria-hidden />
        {pending ? "Preparing…" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
