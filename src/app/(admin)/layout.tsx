import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { buildAdminNav } from "@/components/admin/admin-nav";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { panelHome } from "@/lib/panel";
import { requireUser } from "@/services/user";
import { getSettings } from "@/lib/settings-store";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.panel !== "admin") redirect(panelHome(user.panel));

  // The sidebar writes this cookie when toggled (expanded 16rem, rail 4.5rem).
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "4.5rem",
        } as React.CSSProperties
      }
    >
      <AdminSidebar nav={buildAdminNav(user)} title={`${getSettings().site.name} Admin`} />
      <SidebarInset className="min-w-0 bg-slate-100">
        <AdminTopbar user={user} />
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
      <Toaster theme="light" richColors closeButton />
    </SidebarProvider>
  );
}
