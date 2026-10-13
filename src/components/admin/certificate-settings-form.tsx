"use client";

import { useActionState, useState } from "react";
import { saveCertificateSettings } from "@/actions/settings";
import { MediaField } from "@/components/admin/media-field";
import { SaveBar, SettingsCard, TextField, useSaveToast } from "@/components/admin/settings-fields";
import { CertificateDesign } from "@/components/certificate/certificate-design";
import { initialFormState } from "@/lib/form-state";
import type { MediaSummary } from "@/lib/media-types";
import type { SettingsFormData } from "@/services/settings";

type CertificateFormProps = {
  data: SettingsFormData<"certificate">;
  logo: MediaSummary | null;
  signature: MediaSummary | null;
  // Used where a field is left empty.
  siteName: string;
  verifyUrl: string;
};

// The form on the left writes straight into the certificate below it, so what
// is saved is what was seen.
export function CertificateSettingsForm({ data, logo, signature, siteName, verifyUrl }: CertificateFormProps) {
  const [state, formAction, pending] = useActionState(saveCertificateSettings, initialFormState);
  useSaveToast(state);
  const { values } = data;
  const errors = state.ok ? undefined : state.fieldErrors;

  const [organisationName, setOrganisationName] = useState(values.organisationName);
  const [title, setTitle] = useState(values.title);
  const [signatoryName, setSignatoryName] = useState(values.signatoryName);
  const [signatoryTitle, setSignatoryTitle] = useState(values.signatoryTitle);
  const [logoUrl, setLogoUrl] = useState(logo?.url ?? null);
  const [signatureUrl, setSignatureUrl] = useState(signature?.url ?? null);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid max-w-3xl gap-6" noValidate>
        <SettingsCard title="Wording" description="These apply to every certificate, including the ones already issued.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="organisationName"
              label="Organisation name"
              saved={values.organisationName}
              state={state}
              placeholder={siteName}
              hint="Who issues the certificate. Empty means the site name."
              onValueChange={setOrganisationName}
            />
            <TextField name="title" label="Certificate title" saved={values.title} state={state} onValueChange={setTitle} />
            <TextField
              name="signatoryName"
              label="Signed by"
              saved={values.signatoryName}
              state={state}
              placeholder={`The ${siteName} Team`}
              hint="The person or team named under the signature."
              onValueChange={setSignatoryName}
            />
            <TextField name="signatoryTitle" label="Their job title" saved={values.signatoryTitle} state={state} onValueChange={setSignatoryTitle} />
          </div>
        </SettingsCard>

        <SettingsCard title="Images" description="Chosen from the media library. Both are optional.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MediaField
              name="logoMediaId"
              label="Logo"
              initial={logo}
              error={errors?.logoMediaId}
              hint="Shown at the top instead of the organisation name."
              onChange={(media) => setLogoUrl(media?.url ?? null)}
            />
            <MediaField
              name="signatureMediaId"
              label="Signature"
              initial={signature}
              error={errors?.signatureMediaId}
              hint="A scan or photo of a signature on a clear or white background."
              onChange={(media) => setSignatureUrl(media?.url ?? null)}
            />
          </div>
        </SettingsCard>

        <SaveBar pending={pending} state={state} />
      </form>

      <section aria-label="Preview" className="grid gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Preview</h2>
          <p className="text-sm text-slate-500">With a sample learner and course. It changes as you type; nothing is saved until you press Save changes.</p>
        </div>
        <CertificateDesign
          config={{
            organisationName: organisationName.trim() || siteName,
            title: title.trim() || "Certificate of Completion",
            signatoryName: signatoryName.trim() || `The ${siteName} Team`,
            signatoryTitle: signatoryTitle.trim(),
            logoUrl,
            signatureUrl,
          }}
          learnerName="Alex Sample"
          courseTitle="Sample Course Title"
          issuedOn={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          code="CERT-SAMPLE-0000"
          verifyUrl={verifyUrl}
        />
      </section>
    </div>
  );
}
