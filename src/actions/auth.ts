"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { panelHome } from "@/lib/panel";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeReturnPath } from "@/lib/return-path";
import { logActivity } from "@/services/activity";
import { db } from "@/lib/db";
import { getCurrentUser, getUserPanel } from "@/services/user";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

// The verification email links to Better Auth, which then redirects here.
const VERIFY_CALLBACK = "/verify-email?status=success";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const signUpSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
  });

// Field values are echoed back so the form keeps them after an error.
export type AuthState = {
  error?: string;
  // Set when the message is a neutral confirmation rather than an error.
  notice?: string;
  // Set when the user has to start over (expired challenge or reset link).
  restart?: boolean;
  name?: string;
  email?: string;
};

async function logFailedSignIn(email: string, reason: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  await logActivity({
    userId: user?.id,
    action: "auth.sign-in-failed",
    entity: "user",
    entityId: user?.id,
    details: { email, reason },
  });
}

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({
    email,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password.", email };
  }

  // The same message whether or not the account exists.
  const limited = await checkRateLimit("login", [
    { scope: "email", value: parsed.data.email, limit: 5, windowSeconds: 15 * MINUTE },
    { scope: "ip", limit: 20, windowSeconds: 15 * MINUTE },
  ]);
  if (limited) return { error: limited, email };

  let userId: number;
  try {
    const result = await auth.api.signInEmail({
      body: { ...parsed.data, rememberMe: formData.get("remember") === "on" },
      headers: await headers(),
    });
    // The password was right but the account needs a second factor; the
    // plugin has set its pending-challenge cookie.
    if (!("user" in result)) {
      // Carry the page the visitor was sent from through the second step.
      const back = safeReturnPath(formData.get("next"));
      redirect(back ? `/two-factor?next=${encodeURIComponent(back)}` : "/two-factor");
    }
    userId = Number(result.user.id);
  } catch (error) {
    if (error instanceof APIError) {
      await logFailedSignIn(parsed.data.email, error.message);
      return { error: error.message || "Could not sign in.", email };
    }
    throw error;
  }

  // A page that sent the visitor here (e.g. "Enrol for free") asks to be returned to.
  const returnTo = safeReturnPath(formData.get("next"));
  if (returnTo) redirect(returnTo);
  redirect(panelHome(await getUserPanel(userId)));
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const parsed = signUpSchema.safeParse({
    name,
    email,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path.length === 0);
    return {
      error: mismatch
        ? "Passwords do not match."
        : "Enter your name, a valid email and a password of at least 8 characters.",
      name,
      email,
    };
  }

  const limited = await checkRateLimit("sign-up", [
    { scope: "ip", limit: 10, windowSeconds: HOUR },
  ]);
  if (limited) return { error: limited, name, email };

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL: VERIFY_CALLBACK,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error: error.message || "Could not create the account.",
        name,
        email,
      };
    }
    throw error;
  }

  // Self sign-up always creates a student.
  redirect(panelHome("student"));
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    await logActivity({ userId: user.id, action: "auth.sign-out", entity: "user", entityId: user.id });
  }
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

const forgotSchema = z.object({ email: z.email() });

const resetSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
  });

const FORGOT_NOTICE =
  "If an account exists for that email, a reset link has been sent.";

export async function forgotPassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const parsed = forgotSchema.safeParse({ email });
  if (!parsed.success) return { error: "Enter a valid email address.", email };

  const limited = await checkRateLimit("forgot-password", [
    { scope: "email", value: parsed.data.email, limit: 3, windowSeconds: HOUR },
    { scope: "ip", limit: 10, windowSeconds: HOUR },
  ]);
  if (limited) return { error: limited, email };

  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (error) {
    // Swallowed so the answer never depends on the account.
    if (!(error instanceof APIError)) throw error;
  }
  return { notice: FORGOT_NOTICE };
}

export async function resetPassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path.length === 0);
    return {
      error: mismatch
        ? "Passwords do not match."
        : "Enter a new password of 8 to 128 characters.",
    };
  }

  const limited = await checkRateLimit("reset-password", [
    { scope: "ip", limit: 10, windowSeconds: 15 * MINUTE },
  ]);
  if (limited) return { error: limited };

  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      const invalid = error.body?.code === "INVALID_TOKEN";
      return {
        error: invalid
          ? "This reset link is invalid or has expired."
          : error.message || "Could not reset your password.",
        restart: invalid,
      };
    }
    throw error;
  }

  redirect("/login?reset=success");
}

const codeSchema = z.object({
  method: z.enum(["totp", "backup"]),
  code: z.string().trim().min(1).max(32),
});

export async function verifyTwoFactor(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = codeSchema.safeParse({
    method: formData.get("method"),
    code: formData.get("code"),
  });
  if (!parsed.success || (parsed.data.method === "totp" && !/^\d{6}$/.test(parsed.data.code))) {
    return {
      error:
        parsed.success && parsed.data.method === "backup"
          ? "Enter a backup code."
          : "Enter the 6-digit code from your authenticator app.",
    };
  }

  const limited = await checkRateLimit("two-factor", [
    { scope: "ip", limit: 10, windowSeconds: 15 * MINUTE },
  ]);
  if (limited) return { error: limited };

  const trustDevice = formData.get("trustDevice") === "on";
  let userId: number;
  try {
    const result =
      parsed.data.method === "totp"
        ? await auth.api.verifyTOTP({
            body: { code: parsed.data.code, trustDevice },
            headers: await headers(),
          })
        : await auth.api.verifyBackupCode({
            body: { code: parsed.data.code, trustDevice },
            headers: await headers(),
          });
    userId = Number(result.user.id);
  } catch (error) {
    if (error instanceof APIError) {
      const code = String(error.body?.code ?? "");
      await logActivity({
        action: "auth.sign-in-failed",
        entity: "user",
        details: { reason: "two-factor", method: parsed.data.method, code },
      });
      // The challenge is gone (expired, used up or never started).
      if (
        code === "INVALID_TWO_FACTOR_COOKIE" ||
        code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
      ) {
        return {
          error: "Your sign-in attempt has expired. Log in again to continue.",
          restart: true,
        };
      }
      return { error: error.message || "That code is not valid." };
    }
    throw error;
  }

  const returnTo = safeReturnPath(formData.get("next"));
  if (returnTo) redirect(returnTo);
  redirect(panelHome(await getUserPanel(userId)));
}

export async function resendVerification(): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Log in again.", restart: true };

  const limited = await checkRateLimit("resend-verification", [
    { scope: "user", value: user.id, limit: 3, windowSeconds: HOUR },
    { scope: "ip", limit: 10, windowSeconds: HOUR },
  ]);
  if (limited) return { error: limited };

  try {
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: VERIFY_CALLBACK },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message || "Could not send the email." };
    }
    throw error;
  }
  return { notice: "Verification link sent. Check your inbox." };
}
