import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export type RateLimitInput = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

// Fixed window kept in one row per key. The upsert is a single atomic
// statement, so concurrent requests cannot lose counts. Assignments run left
// to right in MySQL: `count` must be set before `windowStart` resets.
export async function rateLimit({
  key,
  limit,
  windowSeconds,
}: RateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  const expiredBefore = new Date(now.getTime() - windowSeconds * 1000);

  // One transaction keeps the row locked until our own count is read back.
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
    INSERT INTO rate_limit (\`key\`, count, windowStart)
    VALUES (${key}, 1, ${now})
    ON DUPLICATE KEY UPDATE
      count = IF(windowStart <= ${expiredBefore}, 1, count + 1),
      windowStart = IF(windowStart <= ${expiredBefore}, ${now}, windowStart)`;
    return tx.rateLimit.findUnique({ where: { key } });
  });
  if (!row) return { ok: true, retryAfterSeconds: 0 };

  const elapsed = Math.floor((now.getTime() - row.windowStart.getTime()) / 1000);
  return {
    ok: row.count <= limit,
    retryAfterSeconds: Math.max(windowSeconds - elapsed, 1),
  };
}

// Same source as the activity log, so both agree on who the client is.
export async function clientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export function tooManyAttemptsMessage(retryAfterSeconds: number) {
  const minutes = Math.max(Math.ceil(retryAfterSeconds / 60), 1);
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

type Rule = { scope: "ip" | "email" | "user"; value?: string | number; limit: number; windowSeconds: number };

// Checks every rule (all are counted) and returns the friendly message of the
// first that is exhausted, or null when the request may proceed.
export async function checkRateLimit(action: string, rules: Rule[]) {
  const ip = await clientIp();
  let blocked: RateLimitResult | null = null;
  for (const rule of rules) {
    const subject =
      rule.scope === "ip" ? ip : String(rule.value ?? "").toLowerCase().slice(0, 190);
    const result = await rateLimit({
      key: `${action}:${rule.scope}:${subject}`,
      limit: rule.limit,
      windowSeconds: rule.windowSeconds,
    });
    if (!result.ok && !blocked) blocked = result;
  }
  return blocked ? tooManyAttemptsMessage(blocked.retryAfterSeconds) : null;
}

// Expired rows are only ever overwritten, so prune them occasionally.
export async function pruneRateLimits(olderThanSeconds = 24 * 60 * 60) {
  await db.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - olderThanSeconds * 1000) } },
  });
}
