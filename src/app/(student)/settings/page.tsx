import type { Metadata } from "next";
import { TwoFactorSection } from "@/components/auth/two-factor-section";
import { PasswordForm } from "@/components/student/account-forms";
import { PageHeading } from "@/components/student/page-heading";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string; "two-factor"?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const { password } = params;

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

        <TwoFactorSection
          enabled={user.twoFactorEnabled}
          justEnabled={params["two-factor"] === "enabled"}
        />
      </div>
    </>
  );
}
