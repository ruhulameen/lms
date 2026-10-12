"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center rounded-2xl border bg-white p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-500">
        The page could not be loaded. Try again, and contact support if it keeps happening.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-slate-400">Reference: {error.digest}</p>
      )}
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
