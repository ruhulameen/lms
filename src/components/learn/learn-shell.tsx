"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ListVideo, X } from "lucide-react";
import { ProgressBar } from "@/components/student/progress-bar";
import { cn } from "@/lib/utils";

type LearnShellProps = {
  courseTitle: string;
  courseHref: string;
  backHref: string;
  backLabel: string;
  // Null when progress is not tracked for this viewer.
  progress: number | null;
  sidebar: ReactNode;
  children: ReactNode;
};

// The player frame: a slim top bar, the lesson list on the left and the lesson
// on the right. Below lg the list slides over the lesson from a button.
export function LearnShell({ courseTitle, courseHref, backHref, backLabel, progress, sidebar, children }: LearnShellProps) {
  const pathname = usePathname();
  // Open for one page only: moving to another lesson closes the list.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-gray-800">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:gap-5 sm:px-6">
        <Link
          href={backHref}
          className="flex shrink-0 items-center gap-2 rounded text-sm font-semibold text-gray-600 outline-none hover:text-blue-600 focus-visible:ring-3 focus-visible:ring-blue-600/40"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>
        <span className="hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
        <Link
          href={courseHref}
          className="min-w-0 flex-1 truncate text-sm font-bold text-navy outline-none hover:text-blue-600 focus-visible:underline sm:text-base"
        >
          {courseTitle}
        </Link>
        {progress !== null && (
          <div className="hidden w-48 shrink-0 items-center gap-3 md:flex">
            <ProgressBar value={progress} className="flex-1" />
            <span className="w-9 text-right text-xs font-bold text-gray-600">{progress}%</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpenFor(pathname)}
          aria-expanded={open}
          aria-controls="lesson-list"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-navy outline-none hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-blue-600/40 lg:hidden"
        >
          <ListVideo className="size-4" aria-hidden />
          Lessons
        </button>
      </header>
      {progress !== null && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 md:hidden">
          <div className="flex items-center gap-3">
            <ProgressBar value={progress} className="flex-1" />
            <span className="text-xs font-bold text-gray-600">{progress}%</span>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {open && (
          <button
            type="button"
            aria-label="Close lesson list"
            onClick={() => setOpenFor(null)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}
        <aside
          id="lesson-list"
          aria-label="Course lessons"
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[min(22rem,90vw)] overflow-y-auto border-r border-gray-200 bg-white transition-transform duration-200 lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:w-80 lg:shrink-0 lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 lg:hidden">
            <span className="text-sm font-bold text-navy">Course content</span>
            <button
              type="button"
              aria-label="Close lesson list"
              onClick={() => setOpenFor(null)}
              className="rounded p-1 text-gray-500 outline-none hover:text-navy focus-visible:ring-3 focus-visible:ring-blue-600/40"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
