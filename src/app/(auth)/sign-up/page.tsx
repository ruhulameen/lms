import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { panelHome } from "@/lib/panel";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect(panelHome(user.panel));

  return (
    <AuthCard
      icon={UserPlus}
      title="Create Account"
      description="Join EdX Learning and start learning today"
    >
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:underline"
        >
          Log In
        </Link>
      </p>
    </AuthCard>
  );
}
