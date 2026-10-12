import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { panelHome } from "@/lib/panel";
import { getCurrentUser } from "@/services/user";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(panelHome(user.panel));

  return (
    <AuthCard
      icon={BookOpen}
      title="Welcome Back"
      description="Log in to continue your learning journey"
    >
      <LoginForm />
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
