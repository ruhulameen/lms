import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InstructorNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border bg-white p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        This page does not exist or has not been built yet.
      </p>
      <Button className="mt-6" render={<Link href="/instructor" />}>
        Back to dashboard
      </Button>
    </div>
  );
}
