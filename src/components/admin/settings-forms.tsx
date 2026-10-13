"use client";

import { useActionState, useState } from "react";
import {
  applyStorageUploadRule,
  saveEmailSettings,
  savePaymentSettings,
  saveSiteSettings,
  saveStorageSettings,
  testEmailDelivery,
  testStorageConnection,
  testStripeConnection,
} from "@/actions/settings";
import { CopyUrlButton } from "@/components/admin/copy-url-button";
import { FormField, selectClassName } from "@/components/admin/form-field";
import { MediaField } from "@/components/admin/media-field";
import { CheckButton, Notice, SaveBar, SecretField, SettingsCard, SwitchField, TextField, useSaveToast } from "@/components/admin/settings-fields";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState } from "@/lib/form-state";
import { currencies, currencyCodes } from "@/lib/format";
import type { MediaSummary } from "@/lib/media-types";
import type { SettingSource } from "@/lib/settings-schema";
import type { SettingsFormData } from "@/services/settings";

// ---------------------------------------------------------------- site

type SiteFormProps = {
  data: SettingsFormData<"site">;
  logo: MediaSummary | null;
  favicon: MediaSummary | null;
};

export function SiteSettingsForm({ data, logo, favicon }: SiteFormProps) {
  const [state, formAction, pending] = useActionState(saveSiteSettings, initialFormState);
  useSaveToast(state);
  const { values } = data;
  const errors = state.ok ? undefined : state.fieldErrors;

  return (
    <form action={formAction} className="grid max-w-3xl gap-6" noValidate>
      <SettingsCard title="Name and description" description="Shown in the header, the footer, browser tabs and search results.">
        <TextField name="name" label="Site name" saved={values.name} state={state} />
        <TextField name="tagline" label="Tagline" saved={values.tagline} state={state} hint="A few words under the name in the header. Optional." />
        <FormField id="setting-description" label="Description" error={errors?.description} hint="One or two sentences about the site, for the footer and search engines.">
          {(aria) => <Textarea {...aria} name="description" rows={3} defaultValue={state.values?.description ?? values.description} />}
        </FormField>
      </SettingsCard>

      <SettingsCard title="Logo and icon" description="Chosen from the media library. Without a logo the name is shown in type.">
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaField name="logoMediaId" label="Logo" initial={logo} error={errors?.logoMediaId} hint="A wide image with a clear background works best (PNG or WebP)." />
          <MediaField name="faviconMediaId" label="Browser tab icon" initial={favicon} error={errors?.faviconMediaId} hint="A small square image, e.g. 64 × 64 PNG." />
        </div>
      </SettingsCard>

      <SettingsCard title="Contact details" description="Shown in the footer. Leave any of them empty to hide it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="contactEmail" label="Email" type="email" saved={values.contactEmail} state={state} />
          <TextField name="contactPhone" label="Phone" type="tel" saved={values.contactPhone} state={state} />
        </div>
        <FormField id="setting-address" label="Address" error={errors?.address}>
          {(aria) => <Textarea {...aria} name="address" rows={3} defaultValue={state.values?.address ?? values.address} />}
        </FormField>
      </SettingsCard>

      <SettingsCard title="Social links" description="Full addresses starting with https://. Only the ones filled in are shown in the footer.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="facebookUrl" label="Facebook" type="url" saved={values.facebookUrl} state={state} placeholder="https://facebook.com/..." />
          <TextField name="xUrl" label="X (Twitter)" type="url" saved={values.xUrl} state={state} placeholder="https://x.com/..." />
          <TextField name="linkedinUrl" label="LinkedIn" type="url" saved={values.linkedinUrl} state={state} placeholder="https://linkedin.com/company/..." />
          <TextField name="instagramUrl" label="Instagram" type="url" saved={values.instagramUrl} state={state} placeholder="https://instagram.com/..." />
          <TextField name="youtubeUrl" label="YouTube" type="url" saved={values.youtubeUrl} state={state} placeholder="https://youtube.com/@..." />
        </div>
      </SettingsCard>

      <SettingsCard title="Sign-up">
        <SwitchField
          name="allowSignUp"
          label="Let people create their own account"
          description="When off, the sign-up page is closed and accounts are only made by staff. People who already have an account can still log in."
          saved={values.allowSignUp}
          state={state}
        />
      </SettingsCard>

      <SaveBar pending={pending} state={state} />
    </form>
  );
}

// ---------------------------------------------------------------- payments

const expiryChoices = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
];

type PaymentFormProps = {
  data: SettingsFormData<"payment">;
  sources: { stripeSecretKey: SettingSource; stripeWebhookSecret: SettingSource };
  // "test", "live" or null for the key in use.
  mode: "test" | "live" | null;
  webhookUrl: string;
  // The event types the site acts on.
  webhookEvents: string[];
  // Orders already placed in another currency than the saved one.
  otherCurrencyOrders: number;
};

export function PaymentSettingsForm({ data, sources, mode, webhookUrl, webhookEvents, otherCurrencyOrders }: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(savePaymentSettings, initialFormState);
  useSaveToast(state);
  const { values, secrets } = data;
  const errors = state.ok ? undefined : state.fieldErrors;
  const [currency, setCurrency] = useState<string>(state.values?.currency ?? values.currency);
  const [expiry, setExpiry] = useState(state.values?.orderExpiryMinutes ?? String(values.orderExpiryMinutes));
  const hasKey = sources.stripeSecretKey !== "none";

  return (
    <div className="grid max-w-3xl gap-6">
      {!hasKey ? (
        <Notice tone="warn">Stripe is not connected yet, so paid courses cannot be bought. Free courses and 100% coupons still work.</Notice>
      ) : mode === "test" ? (
        <Notice tone="warn">Stripe is in test mode: no real money is taken. Replace the keys with the live ones before selling.</Notice>
      ) : (
        <Notice tone="ok">Stripe is connected{mode === "live" ? " in live mode" : ""}.</Notice>
      )}

      <form action={formAction} className="grid gap-6" noValidate>
        <SettingsCard title="Currency" description="One currency for every course, coupon and order on the site.">
          <FormField
            id="setting-currency"
            label="Currency"
            error={errors?.currency}
            hint="Changing it does not convert anything: a course priced 49 stays 49 in the new currency, so check your prices afterwards."
          >
            {(aria) => (
              <select {...aria} name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${selectClassName} max-w-xs`}>
                {currencyCodes.map((code) => (
                  <option key={code} value={code}>
                    {currencies[code].label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {otherCurrencyOrders > 0 && (
            <Notice tone="warn">
              {otherCurrencyOrders} {otherCurrencyOrders === 1 ? "order was" : "orders were"} placed in another currency. Their amounts are unchanged and are refunded in the
              currency they were paid in, but the order screens show them with the current symbol.
            </Notice>
          )}
        </SettingsCard>

        <SettingsCard title="Checkout">
          <SwitchField
            name="takePayments"
            label="Take payments"
            description="When off, nobody can buy a paid course. Free courses can still be taken, and orders already paid are not affected."
            saved={values.takePayments}
            state={state}
          />
          <FormField
            id="setting-orderExpiryMinutes"
            label="Unpaid orders expire after"
            error={errors?.orderExpiryMinutes}
            hint="How long someone has to finish paying before the order is cancelled and its coupon use is given back."
          >
            {(aria) => (
              <select {...aria} name="orderExpiryMinutes" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={`${selectClassName} max-w-xs`}>
                {expiryChoices.map((choice) => (
                  <option key={choice.minutes} value={choice.minutes}>
                    {choice.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </SettingsCard>

        <SettingsCard
          title="Stripe keys"
          description="Both are found in your Stripe dashboard. They are stored encrypted and never shown again in full."
        >
          <SecretField
            name="stripeSecretKey"
            label="Secret key"
            secret={secrets.stripeSecretKey}
            source={sources.stripeSecretKey}
            state={state}
            placeholder="sk_live_..."
            hint="In Stripe: Developers > API keys > Secret key. It starts with sk_live_ (or sk_test_ for testing)."
          />
          <div className="grid gap-1.5">
            <span className="text-sm leading-none font-medium">Webhook address</span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg border bg-slate-50 px-2.5 py-1.5 text-xs break-all">{webhookUrl}</code>
              <CopyUrlButton value={webhookUrl} />
            </div>
            <p className="text-xs text-slate-500">
              In Stripe: Developers &gt; Webhooks &gt; Add endpoint. Paste this address and choose these events: {webhookEvents.join(", ")}. Stripe then
              shows a signing secret: paste it below.
            </p>
          </div>
          <SecretField
            name="stripeWebhookSecret"
            label="Webhook signing secret"
            secret={secrets.stripeWebhookSecret}
            source={sources.stripeWebhookSecret}
            state={state}
            placeholder="whsec_..."
            hint="It starts with whsec_. Without it a paid order is never marked as paid."
          />
        </SettingsCard>

        <SaveBar pending={pending} state={state} />
      </form>

      <SettingsCard title="Check the connection" description="Tries the saved keys with Stripe. Save your changes first.">
        <CheckButton action={testStripeConnection} label="Check Stripe connection" pendingLabel="Checking..." />
      </SettingsCard>
    </div>
  );
}

// ---------------------------------------------------------------- email

type EmailFormProps = {
  data: SettingsFormData<"email">;
  source: SettingSource;
  // The mail server in use when it comes from the .env file.
  envHost: string | null;
  siteName: string;
  // Where the test email goes.
  testTo: string;
};

export function EmailSettingsForm({ data, source, envHost, siteName, testTo }: EmailFormProps) {
  const [state, formAction, pending] = useActionState(saveEmailSettings, initialFormState);
  useSaveToast(state);
  const { values, secrets } = data;

  return (
    <div className="grid max-w-3xl gap-6">
      {source === "none" && (
        <Notice tone="warn">No mail server is set, so no email leaves the site: verification, password reset and order emails are only written to the server log.</Notice>
      )}
      {source === "env" && (
        <Notice tone="ok">
          Emails are being sent through {envHost}, as set in the server&apos;s .env file. Filling in the mail server below replaces it.
        </Notice>
      )}

      <form action={formAction} className="grid gap-6" noValidate>
        <SettingsCard title="Sender" description="Who emails from the site appear to come from.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="fromName" label="From name" saved={values.fromName} state={state} placeholder={siteName} hint="Empty means the site name." />
            <TextField
              name="fromAddress"
              label="From address"
              type="email"
              saved={values.fromAddress}
              state={state}
              placeholder="hello@example.com"
              hint="Must be an address your mail server is allowed to send from."
            />
          </div>
          <TextField
            name="replyTo"
            label="Reply-to address"
            type="email"
            saved={values.replyTo}
            state={state}
            hint="Optional. Where replies go, if not the from address."
            className="sm:max-w-sm"
          />
        </SettingsCard>

        <SettingsCard title="Mail server (SMTP)" description="Your email provider gives you these four values, usually on a page called SMTP settings.">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <TextField name="smtpHost" label="Server" saved={values.smtpHost} state={state} placeholder="smtp.example.com" />
            <TextField name="smtpPort" label="Port" saved={values.smtpPort} state={state} inputMode="numeric" hint="Usually 587 or 465." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="smtpUser" label="Username" saved={values.smtpUser} state={state} />
            <SecretField name="smtpPassword" label="Password" secret={secrets.smtpPassword} source={source} state={state} />
          </div>
        </SettingsCard>

        <SaveBar pending={pending} state={state} />
      </form>

      <SettingsCard title="Send a test email" description={`Sends one email to ${testTo} with the saved settings, and tells you what the mail server answered. Save your changes first.`}>
        <CheckButton action={testEmailDelivery} label="Send test email" pendingLabel="Sending..." />
      </SettingsCard>
    </div>
  );
}

// ---------------------------------------------------------------- file storage

type StorageFormProps = {
  data: SettingsFormData<"storage">;
  source: SettingSource;
  siteUrl: string;
};

export function StorageSettingsForm({ data, source, siteUrl }: StorageFormProps) {
  const [state, formAction, pending] = useActionState(saveStorageSettings, initialFormState);
  useSaveToast(state);
  const { values, secrets } = data;

  return (
    <div className="grid max-w-3xl gap-6">
      <Notice tone="warn">
        These values decide where every image, video and lesson file is kept. Changing them on a site that already has files makes those files disappear
        from the site until the old values are put back. Set them once, at the start.
      </Notice>
      {source === "none" && <Notice tone="warn">File storage is not set up, so nothing can be uploaded.</Notice>}
      {source === "env" && (
        <Notice tone="ok">Storage is working from the values in the server&apos;s .env file. Filling in the form below replaces all of them at once.</Notice>
      )}

      <form action={formAction} className="grid gap-6" noValidate>
        <SettingsCard title="Cloudflare R2 account" description="In Cloudflare: R2 > Manage API tokens > Create token (Object Read & Write, or Admin Read & Write to let the site set the upload rule below).">
          <TextField name="accountId" label="Account ID" saved={values.accountId} state={state} hint="Shown on the R2 overview page." className="font-mono" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="accessKeyId" label="Access key ID" saved={values.accessKeyId} state={state} className="font-mono" />
            <SecretField name="secretAccessKey" label="Secret access key" secret={secrets.secretAccessKey} source={source} state={state} hint="Shown once when the token is created." />
          </div>
        </SettingsCard>

        <SettingsCard title="Media library" description="Images and files that anyone may see: logos, course pictures, blog images.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="bucket" label="Bucket name" saved={values.bucket} state={state} />
            <TextField
              name="publicUrl"
              label="Public address"
              type="url"
              saved={values.publicUrl}
              state={state}
              placeholder="https://media.example.com"
              hint="The bucket's public address in Cloudflare (a custom domain or its r2.dev address)."
            />
          </div>
        </SettingsCard>

        <SettingsCard title="Lesson files" description="Videos and downloads that only enrolled learners may open. This bucket must stay private (no public address).">
          <TextField name="privateBucket" label="Bucket name" saved={values.privateBucket} state={state} className="sm:max-w-sm" />
        </SettingsCard>

        <SaveBar pending={pending} state={state} />
      </form>

      <SettingsCard title="Check the connection" description="Tries the saved keys and bucket names. Save your changes first.">
        <CheckButton action={testStorageConnection} label="Check storage connection" pendingLabel="Checking..." />
      </SettingsCard>

      <SettingsCard
        title="Allow uploads from this site"
        description={`Uploads go straight from the browser to storage, which the buckets must allow for ${siteUrl}. Press this once after setting the buckets, and again if the site's address changes.`}
      >
        <CheckButton action={applyStorageUploadRule} label="Allow uploads" pendingLabel="Saving the rule..." />
      </SettingsCard>
    </div>
  );
}
