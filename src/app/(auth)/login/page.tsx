import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { panelHome } from "@/lib/panel";
import { safeReturnPath } from "@/lib/return-path";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; next?: string }>;
}) {
  const { reset, next } = await searchParams;
  const returnTo = safeReturnPath(next) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(returnTo ?? panelHome(user.panel));

  return (
    <AuthCard
      icon={BookOpen}
      title="Welcome Back"
      description="Log in to continue your learning journey"
    >
      {reset === "success" && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800"
        >
          Password reset. Log in with your new password.
        </p>
      )}
      <LoginForm next={returnTo} />
      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-blue-600 hover:underline"
        >
          Sign Up
        </Link>
      </p>
    </AuthCard>
  );
}
