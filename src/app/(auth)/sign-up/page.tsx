import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { panelHome } from "@/lib/panel";
import { loginHref, safeReturnPath } from "@/lib/return-path";
import { getCurrentUser } from "@/services/user";
import { getSettings } from "@/lib/settings-store";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(returnTo ?? panelHome(user.panel));

  return (
    <AuthCard
      icon={UserPlus}
      title="Create Account"
      description={`Join ${getSettings().site.name} and start learning today`}
    >
      {getSettings().site.allowSignUp ? (
        <SignUpForm next={returnTo} />
      ) : (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          New sign-ups are closed at the moment. If you already have an account, log in below.
        </p>
      )}
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href={returnTo ? loginHref(returnTo) : "/login"}
          className="font-semibold text-blue-600 hover:underline"
        >
          Log In
        </Link>
      </p>
    </AuthCard>
  );
}
