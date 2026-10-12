import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { hasPendingTwoFactor } from "@/lib/two-factor-challenge";
import { panelHome } from "@/lib/panel";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Two-factor verification",
};

export default async function TwoFactorPage() {
  const user = await getCurrentUser();
  if (user) redirect(panelHome(user.panel));
  if (!(await hasPendingTwoFactor())) redirect("/login");

  return (
    <AuthCard
      icon={ShieldCheck}
      title="Two-Factor Check"
      description="Enter the code from your authenticator app"
    >
      <TwoFactorForm />
      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
