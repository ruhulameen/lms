// A same-site path to send a person back to after signing in. Anything that
// could leave the site (other hosts, protocol-relative URLs) is dropped.
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.length > 300 || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}

export function loginHref(returnTo: string) {
  const safe = safeReturnPath(returnTo);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
