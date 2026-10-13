import { APIError } from "better-auth/api";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// The link in the verification email. Confirms the token, then shows the
// result on /verify-email.
export async function GET(request: NextRequest) {
  const result = new URL("/verify-email", request.url);
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    result.searchParams.set("error", "invalid_token");
    return NextResponse.redirect(result);
  }
  try {
    await auth.api.verifyEmail({ query: { token }, headers: request.headers });
    result.searchParams.set("status", "success");
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    const code = typeof error.body?.code === "string" ? error.body.code.toLowerCase() : "invalid_token";
    result.searchParams.set("error", code);
  }
  return NextResponse.redirect(result);
}
