import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { SiteSettingsForm } from "@/components/admin/settings-forms";
import { SettingsSubnav } from "@/components/admin/settings-subnav";
import { getMediaSummary } from "@/services/media";
import { getSettingsForm } from "@/services/settings";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Settings" };

export default async function SiteSettingsPage() {
  await requirePermission("settings.manage");
  const data = await getSettingsForm("site");
  const [logo, favicon] = await Promise.all([getMediaSummary(data.values.logoMediaId), getMediaSummary(data.values.faviconMediaId)]);

  return (
    <>
      <PageHeader title="Settings" description="The site's name, logo, contact details and sign-up." />
      <SettingsSubnav active="site" />
      <SiteSettingsForm data={data} logo={logo} favicon={favicon} />
    </>
  );
}
