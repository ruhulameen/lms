import { beforeAll, describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { maskSecret, resolveSettings, storedGroup, stripeKeyMode } from "@/lib/settings-schema";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-for-settings";
});

describe("secret box", () => {
  it("opens what it sealed and nothing else", () => {
    const sealed = sealSecret("sk_live_abc123");
    expect(sealed).not.toContain("sk_live_abc123");
    expect(openSecret(sealed)).toBe("sk_live_abc123");
    expect(openSecret("sk_live_abc123")).toBeNull();
    expect(openSecret(`${sealed.slice(0, -2)}xx`)).toBeNull();
  });
});

describe("resolveSettings", () => {
  const open = (sealed: string) => (sealed.startsWith("sealed:") ? sealed.slice(7) : null);

  it("uses defaults and the .env values when nothing is saved", () => {
    const settings = resolveSettings({}, { STRIPE_SECRET_KEY: "sk_test_env", SMTP_HOST: "smtp.env", SMTP_USER: "me@env.test" }, open);
    expect(settings.site.name).toBe("EdX Learning");
    expect(settings.payment.currency).toBe("GBP");
    expect(settings.payment.stripeSecretKey).toBe("sk_test_env");
    expect(settings.sources.stripeSecretKey).toBe("env");
    expect(settings.email.smtp).toEqual({ host: "smtp.env", port: 587, user: "me@env.test", password: "" });
    expect(settings.email.from).toBe('"EdX Learning" <me@env.test>');
    expect(settings.sources.storage).toBe("none");
  });

  it("lets saved settings replace the .env values, a whole connection at a time", () => {
    const settings = resolveSettings(
      {
        site: { name: "Acme Academy" },
        payment: { currency: "USD", stripeSecretKey: "sealed:sk_live_admin", orderExpiryMinutes: 5 },
        email: { smtpHost: "smtp.admin", smtpPort: 465, fromAddress: "hello@acme.test" },
        storage: { accountId: "abc", publicUrl: "https://media.acme.test/" },
        certificate: { logoKey: "media/2026/10/logo one.png" },
      },
      { STRIPE_SECRET_KEY: "sk_test_env", SMTP_HOST: "smtp.env", SMTP_USER: "env-user", SMTP_PASSWORD: "env-pass", R2_BUCKET: "env-bucket" },
      open,
    );
    expect(settings.payment.stripeSecretKey).toBe("sk_live_admin");
    expect(settings.sources.stripeSecretKey).toBe("admin");
    expect(settings.payment.currency).toBe("USD");
    // Stripe needs at least 30 minutes.
    expect(settings.payment.orderExpiryMinutes).toBe(30);
    // The saved server never borrows the .env username or password.
    expect(settings.email.smtp).toEqual({ host: "smtp.admin", port: 465, user: "", password: "" });
    expect(settings.email.from).toBe('"Acme Academy" <hello@acme.test>');
    expect(settings.storage.bucket).toBe("");
    expect(settings.certificate.organisationName).toBe("Acme Academy");
    expect(settings.certificate.logoUrl).toBe("https://media.acme.test/media/2026/10/logo%20one.png");
  });

  it("ignores stored fields that are unknown or of the wrong type", () => {
    expect(storedGroup("payment", { currency: 5, takePayments: "yes", extra: 1 })).toMatchObject({ currency: "GBP", takePayments: true });
    expect(resolveSettings({ payment: { currency: "JPY" } }, {}, open).payment.currency).toBe("GBP");
  });
});

describe("secret display", () => {
  it("shows only the end of a secret", () => {
    expect(maskSecret("sk_live_1234567890abcd")).toBe("••••abcd");
    expect(maskSecret("short")).toBe("••••");
    expect(maskSecret("")).toBe("");
  });

  it("tells test keys from live ones", () => {
    expect(stripeKeyMode("sk_test_x")).toBe("test");
    expect(stripeKeyMode("rk_live_x")).toBe("live");
    expect(stripeKeyMode("pk_live_x")).toBeNull();
  });
});
