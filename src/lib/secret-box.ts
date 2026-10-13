import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Encrypts the secret settings (payment, email and storage keys) before they
// are stored, so a copy of the database alone does not give them away. The key
// is derived from BETTER_AUTH_SECRET: changing that secret makes the stored
// values unreadable, and they have to be entered again.
const PREFIX = "enc:v1:";

function key() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return Buffer.from(hkdfSync("sha256", secret, "", "lms-settings-v1", 32));
}

export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

// The plain value, or null when the text is not a sealed value or cannot be
// opened (wrong key, altered).
export function openSecret(sealed: string): string | null {
  if (!sealed.startsWith(PREFIX)) return null;
  const [iv, tag, body] = sealed.slice(PREFIX.length).split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
