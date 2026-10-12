import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PasswordForm } from "@/components/student/account-forms";
import { PageHeading } from "@/components/student/page-heading";
import { cn } from "@/lib/utils";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const [user, { password }] = await Promise.all([requireUser(), searchParams]);

  return (
    <>
      <PageHeading
        title="Settings"
        description="Manage your account security."
      />

      <div className="max-w-2xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-bold text-navy">Password</h2>
          {password === "changed" && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800"
            >
              Password changed. Other devices have been signed out.
            </p>
          )}
          <PasswordForm />
        </section>

        <section className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck className="size-5" />
          </span>
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-navy">
                Two-factor authentication
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                  user.twoFactorEnabled
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {user.twoFactorEnabled ? "On" : "Off"}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Protect your account with a code from an authenticator app.
              Setup will be available here soon.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
