import type { Metadata } from "next";
import { CertificateSettingsForm } from "@/components/admin/certificate-settings-form";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsSubnav } from "@/components/admin/settings-subnav";
import { getSettings } from "@/lib/settings-store";
import { getMediaSummary } from "@/services/media";
import { getSettingsForm, siteOrigin } from "@/services/settings";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Certificate settings" };

export default async function CertificateSettingsPage() {
  await requirePermission("settings.manage");
  const data = await getSettingsForm("certificate");
  const [logo, signature] = await Promise.all([getMediaSummary(data.values.logoMediaId), getMediaSummary(data.values.signatureMediaId)]);

  return (
    <>
      <PageHeader title="Settings" description="What every certificate says and shows." />
      <SettingsSubnav active="certificate" />
      <CertificateSettingsForm
        data={data}
        logo={logo}
        signature={signature}
        siteName={getSettings().site.name}
        verifyUrl={`${new URL(siteOrigin()).host}/certificates`}
      />
    </>
  );
}
