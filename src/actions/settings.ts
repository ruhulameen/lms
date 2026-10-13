"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { FormState } from "@/lib/form-state";
import { currencyCodes } from "@/lib/format";
import { ORDER_EXPIRY_MAX_MINUTES, ORDER_EXPIRY_MIN_MINUTES, secretFields, type SettingGroup } from "@/lib/settings-schema";
import {
  allowStorageUploads,
  checkStorageConnection,
  checkStripeConnection,
  imageKey,
  saveSettingGroup,
  sendTestEmail,
  type CheckResult,
} from "@/services/settings";
import { authorizeAction } from "@/services/user";

const SAVED = "Settings saved.";

// Shared field shapes. Every text field is trimmed; empty means "not set".
const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`);
const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email address.")]);
const optionalUrl = z
  .string()
  .trim()
  .max(300, "Use at most 300 characters.")
  .refine((value) => value === "" || /^https:\/\/[^\s]+\.[^\s]+$/.test(value), "Enter a full address starting with https://");
const mediaId = z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().int().positive().nullable());
const checkbox = z.preprocess((value) => value === "on", z.boolean());

// What is sent back so the form keeps what was typed. Secrets never are.
function echo(group: SettingGroup, formData: FormData) {
  const secret = new Set<string>(secretFields[group]);
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !secret.has(key)) values[key] = value;
  }
  return values;
}

function invalid(group: SettingGroup, error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: echo(group, formData),
  };
}

function fieldError(group: SettingGroup, field: string, message: string, formData: FormData): FormState {
  return { ok: false, error: message, fieldErrors: { [field]: [message] }, values: echo(group, formData) };
}

// A secret field: typed text replaces the saved value, the "remove" tick
// clears it, and neither keeps what is saved (undefined).
function secretChange(formData: FormData, field: string) {
  const typed = String(formData.get(field) ?? "").trim();
  if (typed) return typed;
  return formData.get(`${field}Remove`) === "on" ? "" : undefined;
}

// ---------------------------------------------------------------- site

const siteSchema = z.object({
  name: text(80).min(1, "Enter the site name."),
  tagline: text(120),
  description: text(300),
  logoMediaId: mediaId,
  faviconMediaId: mediaId,
  contactEmail: optionalEmail,
  contactPhone: text(40),
  address: text(300),
  facebookUrl: optionalUrl,
  xUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  instagramUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  allowSignUp: checkbox,
});

export async function saveSiteSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("settings.manage");
  if (!authz.ok) return { ...authz.result, values: echo("site", formData) };
  const parsed = siteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid("site", parsed.error, formData);

  const [logoKey, faviconKey] = await Promise.all([imageKey(parsed.data.logoMediaId), imageKey(parsed.data.faviconMediaId)]);
  await saveSettingGroup(
    "site",
    {
      ...parsed.data,
      logoMediaId: logoKey ? parsed.data.logoMediaId : null,
      logoKey,
      faviconMediaId: faviconKey ? parsed.data.faviconMediaId : null,
      faviconKey,
    },
    { userId: authz.user.id },
  );
  return { ok: true, message: SAVED, values: echo("site", formData) };
}

// ---------------------------------------------------------------- certificate

const certificateSchema = z.object({
  organisationName: text(80),
  title: text(80).min(1, "Enter the certificate title."),
  signatoryName: text(80),
  signatoryTitle: text(80),
  logoMediaId: mediaId,
  signatureMediaId: mediaId,
});

export async function saveCertificateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("settings.manage");
  if (!authz.ok) return { ...authz.result, values: echo("certificate", formData) };
  const parsed = certificateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid("certificate", parsed.error, formData);

  const [logoKey, signatureKey] = await Promise.all([imageKey(parsed.data.logoMediaId), imageKey(parsed.data.signatureMediaId)]);
  await saveSettingGroup(
    "certificate",
    {
      ...parsed.data,
      logoMediaId: logoKey ? parsed.data.logoMediaId : null,
      logoKey,
      signatureMediaId: signatureKey ? parsed.data.signatureMediaId : null,
      signatureKey,
    },
    { userId: authz.user.id },
  );
  return { ok: true, message: SAVED, values: echo("certificate", formData) };
}

// ---------------------------------------------------------------- payments

const paymentSchema = z.object({
  currency: z.enum(currencyCodes, "Choose a currency."),
  takePayments: checkbox,
  orderExpiryMinutes: z.coerce.number().int().min(ORDER_EXPIRY_MIN_MINUTES).max(ORDER_EXPIRY_MAX_MINUTES),
});

export async function savePaymentSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("settings.manage");
  if (!authz.ok) return { ...authz.result, values: echo("payment", formData) };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid("payment", parsed.error, formData);

  const stripeSecretKey = secretChange(formData, "stripeSecretKey");
  const stripeWebhookSecret = secretChange(formData, "stripeWebhookSecret");
  if (stripeSecretKey && !/^(sk|rk)_(test|live)_\w+$/.test(stripeSecretKey)) {
    return fieldError("payment", "stripeSecretKey", "A Stripe secret key starts with sk_test_ or sk_live_ (the publishable key, pk_..., is not the one).", formData);
  }
  if (stripeWebhookSecret && !/^whsec_\w+$/.test(stripeWebhookSecret)) {
    return fieldError("payment", "stripeWebhookSecret", "A webhook signing secret starts with whsec_.", formData);
  }

  await saveSettingGroup("payment", parsed.data, { secrets: { stripeSecretKey, stripeWebhookSecret }, userId: authz.user.id });
  return { ok: true, message: SAVED, values: echo("payment", formData) };
}

// ---------------------------------------------------------------- email

const emailSchema = z.object({
  fromName: text(80),
  fromAddress: optionalEmail,
  replyTo: optionalEmail,
  smtpHost: text(255).refine((value) => value === "" || /^[a-z0-9.-]+$/i.test(value), "Enter the server name only, e.g. smtp.example.com."),
  smtpPort: z.preprocess((value) => (value === "" ? 587 : value), z.coerce.number("Enter a port number.").int().min(1).max(65535)),
  smtpUser: text(255),
});

export async function saveEmailSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("settings.manage");
  if (!authz.ok) return { ...authz.result, values: echo("email", formData) };
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid("email", parsed.error, formData);

  await saveSettingGroup("email", parsed.data, { secrets: { smtpPassword: secretChange(formData, "smtpPassword") }, userId: authz.user.id });
  return { ok: true, message: SAVED, values: echo("email", formData) };
}

// ---------------------------------------------------------------- file storage

const bucketName = text(63).refine((value) => value === "" || /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value), "Bucket names use lowercase letters, numbers and hyphens.");

const storageSchema = z.object({
  accountId: text(64).refine((value) => value === "" || /^[a-z0-9]+$/i.test(value), "The account ID is letters and numbers only."),
  accessKeyId: text(128),
  bucket: bucketName,
  publicUrl: optionalUrl,
  privateBucket: bucketName,
});

export async function saveStorageSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("settings.manage");
  if (!authz.ok) return { ...authz.result, values: echo("storage", formData) };
  const parsed = storageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid("storage", parsed.error, formData);
  if (parsed.data.bucket && parsed.data.bucket === parsed.data.privateBucket) {
    return fieldError("storage", "privateBucket", "Lesson files need a bucket of their own: the media bucket is public.", formData);
  }

  await saveSettingGroup("storage", parsed.data, { secrets: { secretAccessKey: secretChange(formData, "secretAccessKey") }, userId: authz.user.id });
  return { ok: true, message: SAVED, values: echo("storage", formData) };
}

// ---------------------------------------------------------------- checks

async function runCheck(check: (user: { email: string }) => Promise<CheckResult>): Promise<ActionResult> {
  const authz = await authorizeAction("settings.manage");
  if (!authz.ok) return authz.result;
  return check(authz.user);
}

export const testStripeConnection = async () => runCheck(() => checkStripeConnection());
// Goes to the address of whoever pressed the button.
export const testEmailDelivery = async () => runCheck((user) => sendTestEmail(user.email));
export const testStorageConnection = async () => runCheck(() => checkStorageConnection());
export const applyStorageUploadRule = async () => runCheck(() => allowStorageUploads());
