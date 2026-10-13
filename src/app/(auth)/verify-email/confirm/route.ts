import { APIError } from "better-auth/api";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Sends the browser to the result page. The address is relative on purpose:
// behind a proxy the request's own URL is the internal one (0.0.0.0:3000),
// so building an absolute address from it would leave the site.
function showResult(query: string) {
  return new Response(null, { status: 307, headers: { Location: `/verify-email?${query}` } });
}

// The link in the verification email. Confirms the token, then shows the
// result on /verify-email.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return showResult("error=invalid_token");
  try {
    await auth.api.verifyEmail({ query: { token }, headers: request.headers });
    return showResult("status=success");
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    const code = typeof error.body?.code === "string" ? error.body.code.toLowerCase() : "invalid_token";
    return showResult(`error=${encodeURIComponent(code)}`);
  }
}
