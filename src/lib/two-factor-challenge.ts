import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

// Better Auth sets this signed cookie after a correct password when the account
// has two-factor on. Its presence only means a challenge may be pending; the
// verify endpoints are what actually validate it.
export async function hasPendingTwoFactor() {
  const context = await auth.$context;
  const name = context.createAuthCookie("two_factor").name;
  return (await cookies()).has(name);
}
