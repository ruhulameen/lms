"use client";

import Link from "next/link";
import { ExternalLink, LogOut, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AdminUserMenuProps = {
  user: { name: string; email: string; role: string | null; image: string | null };
};

// The sign-out form lives outside the menu: menu content is portaled, and a
// submit button only submits a form it sits inside in the DOM (or names by id).
export function AdminUserMenu({ user }: AdminUserMenuProps) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className="flex items-center gap-3 rounded-lg p-1 pr-2 text-left outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Avatar>
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="bg-[#0f2a5c] text-xs text-white">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="max-w-40 truncate text-sm leading-tight font-semibold text-slate-900">
              {user.name}
            </span>
            <span className="text-xs leading-tight text-slate-500 capitalize">
              {user.role}
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {user.name}
              </span>
              <span className="truncate">{user.email}</span>
              <span className="capitalize">Role: {user.role}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/admin/account" />}>
            <UserCog />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/" />}>
            <ExternalLink />
            View public site
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<button type="submit" form="admin-sign-out" />}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
