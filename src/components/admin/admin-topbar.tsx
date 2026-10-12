import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { logout } from "@/actions/auth";

type AdminTopbarProps = {
  user: { name: string; email: string; role: string | null; image: string | null };
  accountHref?: string;
};

// 64px bar: sidebar toggle (drawer on mobile), breadcrumb, user menu.
export function AdminTopbar({ user, accountHref }: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 sm:px-6">
      <SidebarTrigger className="size-9" />
      <Separator orientation="vertical" className="h-6" />
      <div className="min-w-0 flex-1">
        <AdminBreadcrumbs />
      </div>
      <AdminUserMenu user={user} accountHref={accountHref} />
      <form id="admin-sign-out" action={logout} />
    </header>
  );
}
