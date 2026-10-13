// When a failed email is tried again. No database or mail imports, so the
// schedule can be unit-tested.

export const EMAIL_MAX_ATTEMPTS = 5;

const MINUTE = 60_000;
// Wait after the 1st, 2nd, 3rd and 4th failed attempt; the 5th failure is final.
const RETRY_DELAYS = [1 * MINUTE, 5 * MINUTE, 30 * MINUTE, 120 * MINUTE];

// `attempts` is how many times the email has been tried so far. Returns the
// time of the next try, or null when it should be given up on.
export function nextEmailTry(attempts: number, now: Date): Date | null {
  if (attempts >= EMAIL_MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS[Math.min(Math.max(attempts, 1), RETRY_DELAYS.length) - 1];
  return new Date(now.getTime() + delay);
}
