"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { UserAvatar } from "@/components/site/user-avatar";
import { studentNav } from "@/components/student/student-nav";
import { cn } from "@/lib/utils";

type StudentSidebarProps = {
  user: { name: string; email: string; image: string | null };
  // Shown as a count next to Notifications.
  unreadNotifications?: number;
};

export function StudentSidebar({ user, unreadNotifications = 0 }: StudentSidebarProps) {
  const pathname = usePathname();
  const badge = (href: string, active: boolean) =>
    href === "/notifications" && unreadNotifications > 0 ? (
      <span
        className={cn(
          "ml-auto rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold tabular-nums",
          active ? "bg-white text-blue-600" : "bg-blue-600 text-white",
        )}
      >
        {unreadNotifications > 99 ? "99+" : unreadNotifications}
        <span className="sr-only"> unread</span>
      </span>
    ) : null;

  return (
    <aside className="h-fit min-w-0 lg:sticky lg:top-24">
      {/* Below lg the nav becomes a scrollable row of pills above the content. */}
      <nav
        aria-label="Student portal"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {studentNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-slate-600 hover:text-blue-600",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {badge(item.href, active)}
            </Link>
          );
        })}
      </nav>

      <div className="hidden rounded-2xl border border-gray-200 bg-white p-4 lg:block">
        <div className="mb-3 flex items-center gap-3 border-b border-gray-100 p-3">
          <UserAvatar name={user.name} image={user.image} className="size-11" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-navy">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <nav aria-label="Student portal" className="space-y-1">
          {studentNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
                  active
                    ? "bg-blue-600 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.5)]"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-600",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {badge(item.href, active)}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
