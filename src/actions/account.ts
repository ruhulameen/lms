"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireUser } from "@/services/user";

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
  await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Enter your current password and a new password of at least 8 characters, typed the same twice.",
    };
  }

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
  redirect("/settings?password=changed");
}
