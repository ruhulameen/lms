"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import type { Panel } from "@/lib/panel";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/services/activity";
import { requireUser } from "@/services/user";

const MINUTE = 60;

export type AccountState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword);

// Each panel has its own account page for the same forms.
function accountPath(panel: Panel) {
  return panel === "admin" ? "/admin/account" : "/settings";
}

function failure(error: unknown, fallback: string): AccountState {
  if (error instanceof APIError) {
    return { status: "error", message: error.message || fallback };
  }
  throw error;
}

export async function updateProfile(
  _prevState: AccountState,
  formData: FormData,
): Promise<AccountState> {
  await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a name of at least 2 characters." };
  }

  try {
    await auth.api.updateUser({
      body: { name: parsed.data.name },
      headers: await headers(),
    });
  } catch (error) {
    return failure(error, "Could not save your profile.");
  }
  return { status: "saved", message: "Profile saved." };
}

export async function changePassword(
  _prevState: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Enter your current password and a new password of at least 8 characters, typed the same twice.",
    };
  }

  const limited = await checkRateLimit("change-password", [
    { scope: "user", value: user.id, limit: 5, windowSeconds: 15 * MINUTE },
    { scope: "ip", limit: 20, windowSeconds: 15 * MINUTE },
  ]);
  if (limited) return { status: "error", message: limited };

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    return failure(error, "Could not change your password.");
  }
  // Changing the password replaces the session, so the page must be loaded
  // again with the new cookie rather than re-rendered in this request.
  await logActivity({ userId: user.id, action: "auth.password-change", entity: "user", entityId: user.id });
  redirect(`${accountPath(user.panel)}?password=changed`);
}

const passwordOnlySchema = z.object({ password: z.string().min(1).max(128) });
const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

// Result of each two-factor step. The setup data is only ever held in the
// browser by the form that asked for it.
export type TwoFactorState = {
  status: "idle" | "error" | "setup" | "codes" | "disabled";
  message?: string;
  qr?: string;
  secret?: string;
  backupCodes?: string[];
};

const idle: TwoFactorState = { status: "idle" };

function twoFactorFailure(error: unknown, fallback: string): TwoFactorState {
  if (error instanceof APIError) {
    return { status: "error", message: error.message || fallback };
  }
  throw error;
}

async function guardTwoFactor(action: string, userId: number) {
  return checkRateLimit(action, [
    { scope: "user", value: userId, limit: 10, windowSeconds: 15 * MINUTE },
    { scope: "ip", limit: 20, windowSeconds: 15 * MINUTE },
  ]);
}

// Step 1: confirm the password and start setup. Two-factor stays off until
// the first code is verified.
export async function startTwoFactorSetup(
  _prevState: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  const parsed = passwordOnlySchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Enter your password." };

  const limited = await guardTwoFactor("two-factor-enable", user.id);
  if (limited) return { status: "error", message: limited };

  try {
    const result = await auth.api.enableTwoFactor({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
    if (result.method !== "totp") return idle;
    const secret = new URL(result.totpURI).searchParams.get("secret") ?? "";
    return {
      status: "setup",
      qr: await QRCode.toDataURL(result.totpURI, { margin: 1, width: 192 }),
      secret,
      backupCodes: result.backupCodes,
    };
  } catch (error) {
    return twoFactorFailure(error, "Could not start two-factor setup.");
  }
}

// Step 2: the first code proves the app is set up, and turns two-factor on.
export async function confirmTwoFactorSetup(
  _prevState: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  const parsed = totpCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { status: "error", message: "Enter the 6-digit code from your app." };
  }

  const limited = await guardTwoFactor("two-factor-enable", user.id);
  if (limited) return { status: "error", message: limited };

  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await headers(),
    });
  } catch (error) {
    return twoFactorFailure(error, "That code is not valid.");
  }
  await logActivity({ userId: user.id, action: "auth.two-factor-enable", entity: "user", entityId: user.id });
  // Like a password change, the first verified code replaces the session, so
  // the page is loaded again with the new cookie.
  redirect(`${accountPath(user.panel)}?two-factor=enabled`);
}

export async function regenerateBackupCodes(
  _prevState: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  const parsed = passwordOnlySchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Enter your password." };

  const limited = await guardTwoFactor("two-factor-backup-codes", user.id);
  if (limited) return { status: "error", message: limited };

  try {
    const result = await auth.api.generateBackupCodes({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
    await logActivity({ userId: user.id, action: "auth.backup-codes-regenerate", entity: "user", entityId: user.id });
    return { status: "codes", backupCodes: result.backupCodes };
  } catch (error) {
    return twoFactorFailure(error, "Could not generate new backup codes.");
  }
}

export async function disableTwoFactor(
  _prevState: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  const parsed = passwordOnlySchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { status: "error", message: "Enter your password." };

  const limited = await guardTwoFactor("two-factor-disable", user.id);
  if (limited) return { status: "error", message: limited };

  try {
    await auth.api.disableTwoFactor({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    return twoFactorFailure(error, "Could not turn off two-factor authentication.");
  }
  await logActivity({ userId: user.id, action: "auth.two-factor-disable", entity: "user", entityId: user.id });
  return { status: "disabled", message: "Two-factor authentication is off." };
}
