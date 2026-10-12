"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { siteNav } from "@/components/site/site-nav";

const linkClassName = "transition hover:text-blue-600";
const activeClassName = "font-semibold text-blue-600";

export function DesktopNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const coursesActive = siteNav.courses.some((item) => isActive(item.href));

  return (
    <div className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
      <Link
        href={siteNav.home.href}
        className={cn(linkClassName, isActive("/") && activeClassName)}
      >
        {siteNav.home.label}
      </Link>
      <div className="group relative">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1",
            linkClassName,
            coursesActive && activeClassName,
          )}
        >
          Courses <ChevronDown className="size-4" />
        </button>
        <div className="invisible absolute top-full left-0 z-50 w-56 pt-2 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
          <div className="rounded-lg border border-gray-100 bg-white py-2 shadow-lg">
            {siteNav.courses.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {siteNav.pages.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(linkClassName, isActive(item.href) && activeClassName)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
