import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { EmailSettingsForm } from "@/components/admin/settings-forms";
import { SettingsSubnav } from "@/components/admin/settings-subnav";
import { getSettings } from "@/lib/settings-store";
import { getSettingsForm } from "@/services/settings";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const user = await requirePermission("settings.manage");
  const data = await getSettingsForm("email");
  const { email, sources, site } = getSettings();

  return (
    <>
      <PageHeader title="Settings" description="Who emails come from and the mail server that sends them." />
      <SettingsSubnav active="email" />
      <EmailSettingsForm
        data={data}
        source={sources.smtp}
        envHost={sources.smtp === "env" ? (email.smtp?.host ?? null) : null}
        siteName={site.name}
        testTo={user.email}
      />
    </>
  );
}
