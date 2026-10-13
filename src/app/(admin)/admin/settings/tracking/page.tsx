import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { TrackingSettingsForm } from "@/components/admin/settings-forms";
import { SettingsSubnav } from "@/components/admin/settings-subnav";
import { getSettingsForm } from "@/services/settings";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Tracking settings" };

export default async function TrackingSettingsPage() {
  await requirePermission("settings.manage");
  const data = await getSettingsForm("tracking");

  return (
    <>
      <PageHeader title="Settings" description="Advertising pixels, analytics and the cookie banner." />
      <SettingsSubnav active="tracking" />
      <TrackingSettingsForm data={data} />
    </>
  );
}
