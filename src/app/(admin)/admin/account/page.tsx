import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { TwoFactorSection } from "@/components/auth/two-factor-section";
import { PasswordForm, ProfileForm } from "@/components/student/account-forms";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Account",
};

// Any signed-in admin-panel user may manage their own account; the layout
// already keeps other panels out.
export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string; "two-factor"?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const { password } = params;

  return (
    <>
      <PageHeader
        title="Account"
        description="Your profile and sign-in security."
      />
      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl border bg-white p-6">
          <h2 className="mb-5 text-lg font-bold">Profile</h2>
          <ProfileForm name={user.name} email={user.email} />
        </section>

        <section className="rounded-xl border bg-white p-6">
          <h2 className="mb-5 text-lg font-bold">Password</h2>
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
