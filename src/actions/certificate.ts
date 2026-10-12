"use server";

import { redirect } from "next/navigation";
import { normaliseCertificateCode } from "@/lib/course";
import type { FormState } from "@/lib/form-state";

// The verification form: tidy up what was typed and go to the certificate's page.
// The lookup itself (and its rate limit) happens on that page.
export async function lookupCertificate(_prev: FormState, formData: FormData): Promise<FormState> {
  const typed = String(formData.get("code") ?? "").slice(0, 100);
  const code = normaliseCertificateCode(typed);
  if (!code) {
    return { ok: false, error: "That is not a certificate ID. It looks like LMS-ABCD-2345-WXYZ.", values: { code: typed } };
  }
  redirect(`/certificates/${code}`);
}
