import "server-only";
import { revalidatePath } from "next/cache";
import { GetBucketCorsCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deliverMailNow } from "@/lib/mailer";
import { openSecret, sealSecret } from "@/lib/secret-box";
import {
  maskSecret,
  secretFields,
  storedGroup,
  stripeKeyMode,
  type SettingGroup,
  type StoredSettings,
} from "@/lib/settings-schema";
import { getSettings, refreshSettings } from "@/lib/settings-store";
import { createStorageClient } from "@/lib/storage";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logActivity } from "@/services/activity";

// Reading and saving the settings screens (/admin/settings). The values the
// app runs on come from src/lib/settings-store.ts; this file is for the forms.

export type SecretState = {
  // A value is saved in the settings (shown masked, never in full).
  saved: boolean;
  // "••••4f2a" for a saved value.
  hint: string;
};

// What a form starts from: the stored fields with every secret taken out and
// described instead.
export type SettingsFormData<G extends SettingGroup> = {
  values: StoredSettings[G];
  secrets: Record<string, SecretState>;
};

export async function getSettingsForm<G extends SettingGroup>(group: G): Promise<SettingsFormData<G>> {
  const row = await db.setting.findUnique({ where: { key: group }, select: { value: true } });
  const values = storedGroup(group, row?.value) as Record<string, unknown>;
  const secrets: Record<string, SecretState> = {};
  for (const field of secretFields[group] as readonly string[]) {
    const sealed = values[field];
    const plain = typeof sealed === "string" && sealed ? (openSecret(sealed) ?? "") : "";
    secrets[field] = { saved: Boolean(plain), hint: maskSecret(plain) };
    values[field] = "";
  }
  return { values: values as StoredSettings[G], secrets };
}

// The object key of a media library image, or null when the id is not one.
export async function imageKey(mediaId: number | null) {
  if (!mediaId) return null;
  const media = await db.media.findFirst({
    where: { id: mediaId, kind: "IMAGE", uploadStatus: "READY" },
    select: { key: true },
  });
  return media?.key ?? null;
}

type SaveOptions<G extends SettingGroup> = {
  // New values for the secret fields: a string replaces the saved one, ""
  // removes it, and a field left out keeps what is saved.
  secrets?: Partial<Record<keyof StoredSettings[G], string>>;
  userId: number;
};

// Saves one group and puts it into effect at once. `fields` holds the plain
// (non-secret) fields; anything not given keeps its stored value.
export async function saveSettingGroup<G extends SettingGroup>(
  group: G,
  fields: Partial<StoredSettings[G]>,
  { secrets = {}, userId }: SaveOptions<G>,
) {
  const row = await db.setting.findUnique({ where: { key: group }, select: { value: true } });
  const before = storedGroup(group, row?.value) as Record<string, unknown>;
  const after: Record<string, unknown> = { ...before, ...fields };

  const secretNames = secretFields[group] as readonly string[];
  const changed: string[] = [];
  for (const [field, value] of Object.entries(secrets)) {
    if (!secretNames.includes(field) || typeof value !== "string") continue;
    after[field] = value ? sealSecret(value) : "";
    if (value || before[field]) changed.push(field);
  }
  for (const key of Object.keys(after)) {
    if (!secretNames.includes(key) && after[key] !== before[key]) changed.push(key);
  }

  const value = after as Prisma.InputJsonObject;
  await db.setting.upsert({
    where: { key: group },
    create: { key: group, value, updatedById: userId },
    update: { value, updatedById: userId },
  });
  await refreshSettings();
  if (changed.length > 0) {
    // Field names only: values (keys and passwords among them) are never logged.
    await logActivity({ userId, action: "settings.update", entity: "setting", entityId: group, details: { group, fields: changed.sort() } });
  }
  // The name, logo, currency and the rest show on every page.
  revalidatePath("/", "layout");
  return { changed };
}

// ---------------------------------------------------------------------------
// "Is it working?" checks behind the buttons on the settings screens. Each one
// tries the values in use now and answers in plain words.
// ---------------------------------------------------------------------------

export type CheckResult = { ok: true; message: string } | { ok: false; error: string };

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300);

export const siteOrigin = () => new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;

// The address Stripe must send its events to.
export const stripeWebhookUrl = () => `${siteOrigin()}/api/stripe/webhook`;

export async function checkStripeConnection(): Promise<CheckResult> {
  if (!isStripeConfigured()) return { ok: false, error: "No Stripe secret key is saved yet." };
  const { stripeSecretKey, stripeWebhookSecret } = getSettings().payment;
  const mode = stripeKeyMode(stripeSecretKey);
  try {
    await getStripe().balance.retrieve();
  } catch (error) {
    return { ok: false, error: `Stripe did not accept the secret key: ${reason(error)}` };
  }
  const connected = `Connected to Stripe${mode ? ` in ${mode} mode` : ""}.`;
  if (!stripeWebhookSecret) {
    return { ok: false, error: `${connected} But no webhook signing secret is saved, so paid orders will not be confirmed.` };
  }
  return { ok: true, message: `${connected} A webhook signing secret is saved.` };
}

export async function sendTestEmail(to: string): Promise<CheckResult> {
  const { email, site } = getSettings();
  if (!email.smtp) return { ok: false, error: "No mail server is saved yet, so emails are not being sent." };
  try {
    await deliverMailNow(
      {
        to,
        subject: `Test email from ${site.name}`,
        text: `This is a test email from ${site.name}.\n\nIf you are reading it, the email settings work.`,
      },
      email,
    );
  } catch (error) {
    return { ok: false, error: `The mail server refused it: ${reason(error)}` };
  }
  return { ok: true, message: `Test email sent to ${to}. Check the inbox (and the spam folder).` };
}

export async function checkStorageConnection(): Promise<CheckResult> {
  const storage = getSettings().storage;
  if (!storage.accountId || !storage.accessKeyId || !storage.secretAccessKey) {
    return { ok: false, error: "The account ID, access key ID and secret access key are needed first." };
  }
  const buckets = [storage.bucket, storage.privateBucket].filter(Boolean);
  if (buckets.length === 0) return { ok: false, error: "No bucket name is saved yet." };
  const client = createStorageClient(storage);
  try {
    for (const Bucket of buckets) {
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        return { ok: false, error: `Could not open the bucket "${Bucket}": ${reason(error)}` };
      }
    }
  } finally {
    client.destroy();
  }
  const missing = [!storage.bucket && "the media bucket", !storage.publicUrl && "the public address", !storage.privateBucket && "the lesson files bucket"].filter(Boolean);
  const reached = `Connected. ${buckets.length === 1 ? "The bucket" : "Both buckets"} can be reached.`;
  return missing.length > 0 ? { ok: false, error: `${reached} Still missing: ${missing.join(", ")}.` } : { ok: true, message: reached };
}

// Lets browsers on this site upload straight to the buckets: without the rule
// every upload in the media library and the lesson editor fails.
export async function allowStorageUploads(): Promise<CheckResult> {
  const storage = getSettings().storage;
  const buckets = [storage.bucket, storage.privateBucket].filter(Boolean);
  if (!storage.accountId || !storage.accessKeyId || !storage.secretAccessKey || buckets.length === 0) {
    return { ok: false, error: "Save the storage keys and bucket names first." };
  }
  const origin = siteOrigin();
  const client = createStorageClient(storage);
  try {
    for (const Bucket of buckets) {
      await client.send(
        new PutBucketCorsCommand({
          Bucket,
          CORSConfiguration: {
            CORSRules: [{ AllowedOrigins: [origin], AllowedMethods: ["PUT"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }],
          },
        }),
      );
      await client.send(new GetBucketCorsCommand({ Bucket }));
    }
  } catch (error) {
    return { ok: false, error: `The upload rule could not be saved. The access key may not be allowed to change bucket settings: ${reason(error)}` };
  } finally {
    client.destroy();
  }
  return { ok: true, message: `Uploads from ${origin} are now allowed on ${buckets.length === 1 ? "the bucket" : "both buckets"}.` };
}

// Orders placed in a currency other than the one given: they keep their own
// amounts but are shown with the site's symbol.
export function countOrdersInOtherCurrency(currency: string) {
  return db.order.count({ where: { currency: { not: currency } } });
}
