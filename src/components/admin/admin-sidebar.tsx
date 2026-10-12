"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { adminNav } from "@/components/admin/admin-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AdminSidebarProps = {
  user: {
    name: string;
    role: string | null;
    image: string | null;
  };
};

const itemClassName =
  "h-10 gap-3 rounded-l-none border-l-[3px] border-transparent px-4 text-sidebar-foreground/70 hover:border-sidebar-primary data-active:border-sidebar-primary data-active:bg-sidebar-primary/15 data-active:text-sidebar-accent-foreground";

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center gap-3 border-b border-sidebar-border px-6 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white">
          <GraduationCap className="size-5 text-sidebar" />
        </div>
        <div className="flex flex-col">
          <span className="text-base leading-tight font-bold text-white">
            EdX Admin
          </span>
          <span className="text-[10px] text-blue-200">v2.0</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {adminNav.map((group) => (
          <SidebarGroup key={group.label} className="py-1 pr-2 pl-0">
            <SidebarGroupLabel className="h-7 px-4 text-[10px] font-bold tracking-widest text-blue-300 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.href ? (
                      <SidebarMenuButton
                        className={itemClassName}
                        isActive={isActive(pathname, item.href)}
                        render={
                          <Link
                            href={item.href}
                            onClick={() => setOpenMobile(false)}
                          />
                        }
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton className={itemClassName} disabled>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="flex-row items-center gap-3 border-t border-sidebar-border p-4">
        <Avatar>
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-white/15 text-xs text-white">
            {user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">
            {user.name}
          </p>
          <p className="truncate text-[10px] text-blue-200 capitalize">
            {user.role}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
