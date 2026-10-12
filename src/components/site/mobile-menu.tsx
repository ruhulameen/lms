"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { logout } from "@/actions/auth";
import { siteNav } from "@/components/site/site-nav";
import { studentNav } from "@/components/student/student-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MobileMenuProps = {
  // Where the signed-in user's panel lives; null when signed out.
  panelHref: string | null;
  isStudent: boolean;
};

const itemClassName =
  "block rounded-lg px-4 py-3 hover:bg-blue-50 hover:text-blue-600";

export function MobileMenu({ panelHref, isStudent }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          />
        }
      >
        <Menu className="size-6" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 gap-0 bg-white">
        <SheetHeader className="border-b border-gray-100">
          <SheetTitle className="text-lg font-bold text-navy">Menu</SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 overflow-y-auto p-4 text-sm font-medium text-gray-700">
          <Link href="/" onClick={close} className={itemClassName}>
            Home
          </Link>
          <p className="mt-2 px-4 py-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
            Courses
          </p>
          {siteNav.courses.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={`${itemClassName} pl-6`}
            >
              {item.label}
            </Link>
          ))}
          {siteNav.pages.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={itemClassName}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/cart" onClick={close} className={itemClassName}>
            Cart
          </Link>
          <div className="my-3 border-t border-gray-100" />
          {panelHref ? (
            <>
              {isStudent ? (
                <>
                  <p className="px-4 py-2 text-xs font-bold tracking-wider text-gray-400 uppercase">
                    Student Portal
                  </p>
                  {studentNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className={`${itemClassName} flex items-center gap-3`}
                    >
                      <item.icon className="size-4 text-gray-400" />
                      {item.label}
                    </Link>
                  ))}
                </>
              ) : (
                <Link href={panelHref} onClick={close} className={itemClassName}>
                  My Dashboard
                </Link>
              )}
              <form action={logout}>
                <button
                  type="submit"
                  className={`${itemClassName} w-full text-left`}
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" onClick={close} className={itemClassName}>
                Login
              </Link>
              <Link
                href="/sign-up"
                onClick={close}
                className="block rounded-lg bg-blue-600 px-4 py-3 text-center font-semibold text-white"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
