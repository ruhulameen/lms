import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { panelHome } from "@/lib/panel";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect(panelHome(user.panel));

  return (
    <AuthCard
      icon={KeyRound}
      title="Forgot Password?"
      description="Enter your email and we'll send you a reset link"
    >
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-gray-600">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
