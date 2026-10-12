"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, GraduationCap } from "lucide-react";
import type {
  AdminNavGroupView,
  AdminNavLinkView,
  AdminNavView,
} from "@/components/admin/admin-nav";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type AdminSidebarProps = {
  // Already filtered by the current user's permissions on the server.
  nav: AdminNavView;
};

const rowClassName =
  "h-10 gap-3 px-3 text-sidebar-foreground/75 group-data-[collapsible=icon]:mx-auto data-active:bg-sidebar-primary/20 data-active:text-sidebar-accent-foreground";

function isGroup(
  entry: AdminNavLinkView | AdminNavGroupView,
): entry is AdminNavGroupView {
  return "items" in entry;
}

// The most specific link wins, so /admin/users/roles does not also light up /admin/users.
function findActiveHref(nav: AdminNavView, pathname: string) {
  const hrefs = nav
    .flatMap((entry) => (isGroup(entry) ? entry.items : [entry]))
    .flatMap((item) => (item.href ? [item.href] : []))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return hrefs.sort((a, b) => b.length - a.length)[0];
}

function NavLink({
  item,
  active,
}: {
  item: AdminNavLinkView;
  active: boolean;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      {item.href ? (
        <SidebarMenuButton
          className={rowClassName}
          isActive={active}
          tooltip={item.label}
          render={
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpenMobile(false)}
            />
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton className={rowClassName} tooltip={item.label} disabled>
          {item.icon}
          <span>{item.label}</span>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

function NavGroup({
  group,
  activeHref,
}: {
  group: AdminNavGroupView;
  activeHref?: string;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const hasActive = group.items.some((item) => item.href === activeHref);

  // On the icon rail a group becomes a menu that opens beside the icon.
  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className={rowClassName}
                isActive={hasActive}
                tooltip={group.label}
              />
            }
          >
            {group.icon}
            <span>{group.label}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
            {group.items.map((item) =>
              item.href ? (
                <DropdownMenuItem
                  key={item.label}
                  render={<Link href={item.href} />}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={item.label} disabled>
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible defaultOpen={hasActive} render={<SidebarMenuItem />}>
      <CollapsibleTrigger
        render={<SidebarMenuButton className={`${rowClassName} group/trigger`} />}
      >
        {group.icon}
        <span>{group.label}</span>
        <ChevronRight className="ml-auto transition-transform group-data-panel-open/trigger:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mt-1 mb-2">
          {group.items.map((item) => (
            <SidebarMenuSubItem key={item.label}>
              {item.href ? (
                <SidebarMenuSubButton
                  isActive={item.href === activeHref}
                  render={
                    <Link
                      href={item.href}
                      aria-current={item.href === activeHref ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </SidebarMenuSubButton>
              ) : (
                <SidebarMenuSubButton
                  aria-disabled="true"
                  title="Not available yet"
                  className="cursor-not-allowed text-sidebar-foreground/50"
                  render={<span />}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </SidebarMenuSubButton>
              )}
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AdminSidebar({ nav }: AdminSidebarProps) {
  const pathname = usePathname();
  const activeHref = findActiveHref(nav, pathname);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center gap-3 border-b border-sidebar-border px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white">
          <GraduationCap className="size-5 text-sidebar" />
        </div>
        <span className="text-base font-bold text-white group-data-[collapsible=icon]:hidden">
          EdX Admin
        </span>
      </SidebarHeader>

      <SidebarContent className="px-3 py-3 group-data-[collapsible=icon]:px-0">
        <SidebarMenu className="gap-0.5">
          {nav.map((entry) =>
            isGroup(entry) ? (
              <NavGroup key={entry.label} group={entry} activeHref={activeHref} />
            ) : (
              <NavLink
                key={entry.label}
                item={entry}
                active={entry.href === activeHref}
              />
            ),
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
