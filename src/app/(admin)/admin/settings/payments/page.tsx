import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PaymentSettingsForm } from "@/components/admin/settings-forms";
import { SettingsSubnav } from "@/components/admin/settings-subnav";
import { stripeKeyMode } from "@/lib/settings-schema";
import { getSettings } from "@/lib/settings-store";
import { countOrdersInOtherCurrency, getSettingsForm, stripeWebhookUrl } from "@/services/settings";
import { stripeEventHandlers } from "@/services/stripe-webhook";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Payment settings" };

export default async function PaymentSettingsPage() {
  await requirePermission("settings.manage");
  const data = await getSettingsForm("payment");
  const { payment, sources } = getSettings();
  const otherCurrencyOrders = await countOrdersInOtherCurrency(data.values.currency);

  return (
    <>
      <PageHeader title="Settings" description="Currency, checkout and the connection to Stripe." />
      <SettingsSubnav active="payment" />
      <PaymentSettingsForm
        data={data}
        sources={{ stripeSecretKey: sources.stripeSecretKey, stripeWebhookSecret: sources.stripeWebhookSecret }}
        mode={stripeKeyMode(payment.stripeSecretKey)}
        webhookUrl={stripeWebhookUrl()}
        webhookEvents={Object.keys(stripeEventHandlers)}
        otherCurrencyOrders={otherCurrencyOrders}
      />
    </>
  );
}
