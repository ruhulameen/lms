import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const user = await requireUser();

  return (
    <>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#0f2a5c]">
          <LayoutDashboard className="size-6 text-blue-600" />
          Dashboard Overview
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Welcome back, {user.name}.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-gray-800">Nothing to show yet</p>
        <p className="mt-1 text-sm text-gray-500">
          Dashboard widgets appear here as each module is built.
        </p>
      </div>
    </>
  );
}
