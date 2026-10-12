import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { getCurrentUser } from "@/services/user";
import { panelHome } from "@/lib/panel";

export const metadata: Metadata = {
  title: "Verify email",
};

const ERRORS: Record<string, string> = {
  token_expired: "This verification link has expired.",
  invalid_token: "This verification link is invalid.",
};

// Better Auth redirects here after /api/auth/verify-email, appending `error`
// on failure; `status=success` is added by our callbackURL.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const user = await getCurrentUser();
  const verified = status === "success" && !error;

  return (
    <AuthCard
      icon={verified ? MailCheck : CircleAlert}
      title={verified ? "Email Verified" : "Verification Failed"}
      description={
        verified ? "Your email address is confirmed" : "We couldn't verify your email"
      }
    >
      <div className="space-y-4 text-center">
        {verified ? (
          <p role="status" className="text-sm text-gray-600">
            Thanks, you&apos;re all set.
          </p>
        ) : (
          <p role="alert" className="text-sm text-red-600">
            {(error && ERRORS[error.toLowerCase()]) ??
              "This verification link is invalid or has expired."}{" "}
            {user
              ? "You can request a new link from your account."
              : "Log in to request a new link."}
          </p>
        )}
        <Link
          href={user ? panelHome(user.panel) : "/login"}
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40"
        >
          {user ? "Go to your dashboard" : "Log in"}
        </Link>
      </div>
    </AuthCard>
  );
}
