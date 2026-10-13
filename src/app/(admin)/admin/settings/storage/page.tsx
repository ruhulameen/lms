import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { StorageSettingsForm } from "@/components/admin/settings-forms";
import { SettingsSubnav } from "@/components/admin/settings-subnav";
import { getSettings } from "@/lib/settings-store";
import { getSettingsForm, siteOrigin } from "@/services/settings";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "File storage settings" };

export default async function StorageSettingsPage() {
  await requirePermission("settings.manage");
  const data = await getSettingsForm("storage");

  return (
    <>
      <PageHeader title="Settings" description="Where uploaded images, videos and lesson files are kept." />
      <SettingsSubnav active="storage" />
      <StorageSettingsForm data={data} source={getSettings().sources.storage} siteUrl={siteOrigin()} />
    </>
  );
}
