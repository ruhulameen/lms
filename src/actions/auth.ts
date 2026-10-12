"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { panelHome } from "@/lib/panel";
import { getUserPanel } from "@/services/user";

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
  name?: string;
  email?: string;
};

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

  let userId: number;
  try {
    const result = await auth.api.signInEmail({
      body: { ...parsed.data, rememberMe: formData.get("remember") === "on" },
      headers: await headers(),
    });
    if (!("user" in result)) {
      return { error: "Two-factor sign-in is not available yet.", email };
    }
    userId = Number(result.user.id);
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message || "Could not sign in.", email };
    }
    throw error;
  }

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

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
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
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
