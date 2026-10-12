import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Role given to anyone who signs up themselves.
const DEFAULT_ROLE = "student";

export const auth = betterAuth({
  appName: "LMS",
  database: prismaAdapter(db, { provider: "mysql" }),
  advanced: {
    database: { generateId: "serial" },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password: ${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        text: `Verify your email: ${url}`,
      });
    },
  },
  user: {
    additionalFields: {
      roleId: { type: "number", required: false, input: false },
      status: {
        type: ["ACTIVE", "SUSPENDED", "BANNED"],
        required: false,
        defaultValue: "ACTIVE",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const role = await db.role.findUnique({
            where: { name: DEFAULT_ROLE },
          });
          return { data: { ...user, roleId: role?.id ?? null } };
        },
      },
    },
    session: {
      create: {
        // Runs on every sign-in: suspended and banned accounts get no session.
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: Number(session.userId) },
            select: { status: true },
          });
          if (user?.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", {
              message: "This account is not active.",
            });
          }
        },
      },
    },
  },
  // Authenticator app (TOTP) and backup codes only; emailed codes stay off
  // because `otpOptions.sendOTP` is not configured.
  plugins: [twoFactor(), nextCookies()],
});
