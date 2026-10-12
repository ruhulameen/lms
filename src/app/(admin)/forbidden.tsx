import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Rendered with a 403 when requirePermission() fails on an admin page.
export default function AdminForbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border bg-white p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <ShieldAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">No access</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your role does not include permission to view this page. Ask an
        administrator if you need it.
      </p>
      <Button className="mt-6" render={<Link href="/admin" />}>
        Back to dashboard
      </Button>
    </div>
  );
}
