import { type CurrencyCode, DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/format";

// What the settings screens (/admin/settings) store, and how the stored rows
// turn into the values the app runs on. Pure: no database, no crypto, so the
// forms and the unit tests can use it.
//
// One row per group in the `setting` table. A missing row or field means the
// default below. For the keys that used to live only in the server's .env file
// (Stripe, SMTP, R2), an empty setting falls back to the .env value, so a
// server set up that way keeps working until the screens are filled in.

export const settingGroups = ["site", "certificate", "payment", "email", "storage", "tracking"] as const;
export type SettingGroup = (typeof settingGroups)[number];

export const settingGroupLabels: Record<SettingGroup, string> = {
  site: "Site",
  certificate: "Certificate",
  payment: "Payments",
  email: "Email",
  storage: "File storage",
  tracking: "Tracking",
};

export const settingDefaults = {
  site: {
    name: "EdX Learning",
    tagline: "Learn Today · Build Tomorrow",
    description:
      "A trusted online learning platform providing high-quality, flexible and affordable courses to help you achieve your career and personal goals.",
    // Images are media library files: the id for the form, the object key for the link.
    logoMediaId: null as number | null,
    logoKey: null as string | null,
    faviconMediaId: null as number | null,
    faviconKey: null as string | null,
    contactEmail: "",
    contactPhone: "",
    address: "",
    facebookUrl: "",
    xUrl: "",
    linkedinUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    allowSignUp: true,
  },
  certificate: {
    // Empty means the site name.
    organisationName: "",
    title: "Certificate of Completion",
    // Empty means "The <site name> Team".
    signatoryName: "",
    signatoryTitle: "Learning & Development",
    logoMediaId: null as number | null,
    logoKey: null as string | null,
    signatureMediaId: null as number | null,
    signatureKey: null as string | null,
  },
  payment: {
    currency: DEFAULT_CURRENCY as CurrencyCode,
    takePayments: true,
    orderExpiryMinutes: 60,
    stripeSecretKey: "",
    stripeWebhookSecret: "",
  },
  email: {
    fromName: "",
    fromAddress: "",
    replyTo: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
  },
  storage: {
    accountId: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    publicUrl: "",
    privateBucket: "",
  },
  tracking: {
    // Ask visitors before any tag loads. Only switch off where the law does not ask for it.
    consentBanner: true,
    gtmId: "",
    ga4Id: "",
    // With it, purchases are also reported to Google Analytics from the server.
    ga4ApiSecret: "",
    metaPixelId: "",
    // With it, purchases are also reported to Meta from the server (Conversions API).
    metaAccessToken: "",
    metaTestEventCode: "",
    googleAdsId: "",
    googleAdsPurchaseLabel: "",
    tiktokPixelId: "",
    linkedinPartnerId: "",
  },
};

export type StoredSettings = typeof settingDefaults;

// Stored encrypted, never sent back to the browser.
export const secretFields = {
  site: [],
  certificate: [],
  payment: ["stripeSecretKey", "stripeWebhookSecret"],
  email: ["smtpPassword"],
  storage: ["secretAccessKey"],
  tracking: ["ga4ApiSecret", "metaAccessToken"],
} as const satisfies { [G in SettingGroup]: readonly (keyof StoredSettings[G])[] };

export const ORDER_EXPIRY_MIN_MINUTES = 30;
export const ORDER_EXPIRY_MAX_MINUTES = 24 * 60;

// Where a value in use comes from: the settings screen, the server's .env
// file, or nowhere (not set up).
export type SettingSource = "admin" | "env" | "none";

export type Settings = {
  site: {
    name: string;
    tagline: string;
    description: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    contactEmail: string;
    contactPhone: string;
    address: string;
    social: { label: string; url: string }[];
    allowSignUp: boolean;
  };
  certificate: {
    organisationName: string;
    title: string;
    signatoryName: string;
    signatoryTitle: string;
    logoUrl: string | null;
    signatureUrl: string | null;
  };
  payment: {
    currency: CurrencyCode;
    takePayments: boolean;
    orderExpiryMinutes: number;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
  };
  email: {
    // The From header, e.g. `EdX Learning <hello@example.com>`; empty when no address is known.
    from: string;
    replyTo: string;
    // Null means not set up: emails are printed to the server console.
    smtp: { host: string; port: number; user: string; password: string } | null;
  };
  storage: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
    privateBucket: string;
  };
  tracking: StoredSettings["tracking"];
  sources: {
    stripeSecretKey: SettingSource;
    stripeWebhookSecret: SettingSource;
    smtp: SettingSource;
    storage: SettingSource;
  };
};

type Env = Record<string, string | undefined>;
type Rows = Partial<Record<SettingGroup, unknown>>;

// A group's stored fields over its defaults. Unknown or wrongly typed fields
// are dropped, so an old or hand-edited row can never break the site.
export function storedGroup<G extends SettingGroup>(group: G, row: unknown): StoredSettings[G] {
  const defaults = settingDefaults[group] as Record<string, unknown>;
  const result: Record<string, unknown> = { ...defaults };
  if (row && typeof row === "object" && !Array.isArray(row)) {
    for (const [key, value] of Object.entries(row)) {
      if (!(key in defaults)) continue;
      const fallback = defaults[key];
      if (fallback === null ? value === null || typeof value === "string" || typeof value === "number" : typeof value === typeof fallback) {
        result[key] = value;
      }
    }
  }
  return result as StoredSettings[G];
}

// Link to a file in the public bucket, or null without a public address.
export function objectUrl(base: string, key: string | null) {
  if (!base || !key) return null;
  return `${base.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function clampExpiry(minutes: number) {
  if (!Number.isFinite(minutes)) return settingDefaults.payment.orderExpiryMinutes;
  return Math.min(ORDER_EXPIRY_MAX_MINUTES, Math.max(ORDER_EXPIRY_MIN_MINUTES, Math.round(minutes)));
}

// `open` turns a stored secret back into its plain value (null when it cannot).
export function resolveSettings(rows: Rows, env: Env, open: (sealed: string) => string | null): Settings {
  const site = storedGroup("site", rows.site);
  const certificate = storedGroup("certificate", rows.certificate);
  const payment = storedGroup("payment", rows.payment);
  const email = storedGroup("email", rows.email);
  const storage = storedGroup("storage", rows.storage);
  const tracking = storedGroup("tracking", rows.tracking);
  const secret = (sealed: string) => (sealed ? (open(sealed) ?? "") : "");

  // Each Stripe key on its own: the admin value, else the .env one.
  const pick = (admin: string, fromEnv: string | undefined): [string, SettingSource] =>
    admin ? [admin, "admin"] : fromEnv ? [fromEnv, "env"] : ["", "none"];
  const [stripeSecretKey, stripeSecretKeySource] = pick(secret(payment.stripeSecretKey), env.STRIPE_SECRET_KEY);
  const [stripeWebhookSecret, stripeWebhookSecretSource] = pick(secret(payment.stripeWebhookSecret), env.STRIPE_WEBHOOK_SECRET);

  // SMTP and storage as a whole: a server name with someone else's password is
  // worse than no connection at all.
  const smtpSource: SettingSource = email.smtpHost ? "admin" : env.SMTP_HOST ? "env" : "none";
  const smtp =
    smtpSource === "admin"
      ? { host: email.smtpHost, port: email.smtpPort || 587, user: email.smtpUser, password: secret(email.smtpPassword) }
      : smtpSource === "env"
        ? { host: env.SMTP_HOST!, port: Number(env.SMTP_PORT) || 587, user: env.SMTP_USER ?? "", password: env.SMTP_PASSWORD ?? "" }
        : null;

  const fromAddress = email.fromAddress || addressOf(env.EMAIL_FROM) || smtp?.user || "";
  const fromName = email.fromName || (email.fromAddress ? site.name : nameOf(env.EMAIL_FROM) || site.name);
  const from = fromAddress.includes("@") ? `${quoteName(fromName)} <${fromAddress}>` : "";

  const storageSource: SettingSource = storage.accountId ? "admin" : env.R2_ACCOUNT_ID ? "env" : "none";
  const resolvedStorage =
    storageSource === "admin"
      ? { ...storage, secretAccessKey: secret(storage.secretAccessKey) }
      : {
          accountId: env.R2_ACCOUNT_ID ?? "",
          accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
          secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
          bucket: env.R2_BUCKET ?? "",
          publicUrl: env.R2_PUBLIC_URL ?? "",
          privateBucket: env.R2_PRIVATE_BUCKET ?? "",
        };

  const social = [
    { label: "Facebook", url: site.facebookUrl },
    { label: "X", url: site.xUrl },
    { label: "LinkedIn", url: site.linkedinUrl },
    { label: "Instagram", url: site.instagramUrl },
    { label: "YouTube", url: site.youtubeUrl },
  ].filter((link) => link.url);

  return {
    site: {
      name: site.name,
      tagline: site.tagline,
      description: site.description,
      logoUrl: objectUrl(resolvedStorage.publicUrl, site.logoKey),
      faviconUrl: objectUrl(resolvedStorage.publicUrl, site.faviconKey),
      contactEmail: site.contactEmail,
      contactPhone: site.contactPhone,
      address: site.address,
      social,
      allowSignUp: site.allowSignUp,
    },
    certificate: {
      organisationName: certificate.organisationName || site.name,
      title: certificate.title || settingDefaults.certificate.title,
      signatoryName: certificate.signatoryName || `The ${site.name} Team`,
      signatoryTitle: certificate.signatoryTitle,
      logoUrl: objectUrl(resolvedStorage.publicUrl, certificate.logoKey),
      signatureUrl: objectUrl(resolvedStorage.publicUrl, certificate.signatureKey),
    },
    payment: {
      currency: isCurrencyCode(payment.currency) ? payment.currency : DEFAULT_CURRENCY,
      takePayments: payment.takePayments,
      orderExpiryMinutes: clampExpiry(payment.orderExpiryMinutes),
      stripeSecretKey,
      stripeWebhookSecret,
    },
    email: { from, replyTo: email.replyTo, smtp },
    storage: resolvedStorage,
    tracking: { ...tracking, ga4ApiSecret: secret(tracking.ga4ApiSecret), metaAccessToken: secret(tracking.metaAccessToken) },
    sources: {
      stripeSecretKey: stripeSecretKeySource,
      stripeWebhookSecret: stripeWebhookSecretSource,
      smtp: smtpSource,
      storage: storageSource,
    },
  };
}

// EMAIL_FROM in .env may be a bare address or `Name <address>`.
function addressOf(value: string | undefined) {
  if (!value) return "";
  return (/<([^>]+)>/.exec(value)?.[1] ?? value).trim();
}

function nameOf(value: string | undefined) {
  if (!value || !value.includes("<")) return "";
  return value.slice(0, value.indexOf("<")).trim().replace(/^"|"$/g, "");
}

function quoteName(name: string) {
  return `"${name.replace(/["\\\r\n]/g, "")}"`;
}

// What a settings screen shows for a saved secret: the last four characters.
export function maskSecret(plain: string) {
  if (!plain) return "";
  return plain.length <= 8 ? "••••" : `••••${plain.slice(-4)}`;
}

// "test" or "live" from a Stripe secret key, or null when it is neither.
export function stripeKeyMode(key: string): "test" | "live" | null {
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return null;
}
