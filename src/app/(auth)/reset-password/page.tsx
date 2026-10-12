import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const usable = token && !error;

  return (
    <AuthCard
      icon={Lock}
      title="Reset Password"
      description={usable ? "Choose a new password for your account" : "This link can't be used"}
    >
      {usable ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4 text-center">
          <p role="alert" className="text-sm text-red-600">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40"
          >
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
