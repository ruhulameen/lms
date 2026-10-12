"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { UserAvatar } from "@/components/site/user-avatar";
import { studentNav } from "@/components/student/student-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Panel } from "@/lib/panel";

type UserMenuProps = {
  user: { name: string; email: string; image: string | null };
  panel: Panel;
  panelHref: string;
};

const itemClassName = "gap-3 px-4 py-2.5 text-sm text-navy";

export function UserMenu({ user, panel, panelHref }: UserMenuProps) {
  const links =
    panel === "student"
      ? studentNav
      : [{ label: "My Dashboard", href: panelHref, icon: LayoutDashboard }];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-full border border-gray-200 p-1 transition hover:bg-gray-100 sm:pl-3"
          />
        }
      >
        <span className="hidden max-w-32 truncate text-xs font-bold text-navy sm:inline">
          {user.name}
        </span>
        <UserAvatar name={user.name} image={user.image} className="size-8 text-sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 rounded-2xl border border-gray-100 bg-white p-0 py-2 shadow-2xl"
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="truncate text-sm font-bold text-navy">{user.name}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
        <div className="py-1">
          {links.map((link) => (
            <DropdownMenuItem
              key={link.href}
              className={itemClassName}
              render={<Link href={link.href} />}
            >
              <link.icon className="text-gray-500" />
              {link.label}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem
            variant="destructive"
            className={`${itemClassName} w-full`}
            render={<button type="submit" />}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
