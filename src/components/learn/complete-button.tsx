"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { markLessonComplete } from "@/actions/learning";

// "Mark as complete" for text and document lessons.
export function CompleteButton({ lessonId, completed }: { lessonId: number; completed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (completed) {
    return (
      <span className="flex items-center gap-2 rounded-lg bg-green-50 px-5 py-3 text-sm font-bold text-green-700">
        <Check className="size-4" aria-hidden /> Completed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await markLessonComplete(lessonId);
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
        className="rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white transition outline-none hover:bg-green-700 focus-visible:ring-3 focus-visible:ring-green-600/40 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark as complete"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
