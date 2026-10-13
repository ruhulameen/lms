import { describe, expect, it } from "vitest";
import { EMAIL_MAX_ATTEMPTS, nextEmailTry } from "@/lib/email-retry";

const now = new Date("2026-10-13T10:00:00Z");
const minutesLater = (attempts: number) => (nextEmailTry(attempts, now)!.getTime() - now.getTime()) / 60_000;

describe("nextEmailTry", () => {
  it("waits longer after each failed attempt", () => {
    expect([1, 2, 3, 4].map(minutesLater)).toEqual([1, 5, 30, 120]);
  });

  it("gives up after the last attempt", () => {
    expect(nextEmailTry(EMAIL_MAX_ATTEMPTS, now)).toBeNull();
  });
});
