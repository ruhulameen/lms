import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { panelHome } from "@/lib/panel";
import { requireUser } from "@/services/user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.panel !== "admin") redirect(panelHome(user.panel));

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AdminSidebar
        user={{ name: user.name, role: user.role, image: user.image }}
      />
      <SidebarInset className="min-w-0 bg-slate-100">
        {/* Mobile top bar: the sidebar becomes a drawer below the md breakpoint. */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-white md:hidden">
          <SidebarTrigger className="text-white hover:bg-sidebar-accent hover:text-white" />
          <GraduationCap className="size-5" />
          <span className="text-sm font-bold">EdX Admin</span>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
