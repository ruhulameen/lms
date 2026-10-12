import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { DesktopNav } from "@/components/site/desktop-nav";
import { Logo } from "@/components/site/logo";
import { MobileMenu } from "@/components/site/mobile-menu";
import { UserMenu } from "@/components/site/user-menu";
import { panelHome } from "@/lib/panel";
import { getCart } from "@/services/cart";
import { getCurrentUser } from "@/services/user";

const iconLinkClassName = "text-gray-500 transition hover:text-blue-600";

export async function SiteHeader() {
  const [user, cart] = await Promise.all([getCurrentUser(), getCart()]);
  const panelHref = user ? panelHome(user.panel) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <DesktopNav />
        <div className="flex items-center gap-3 md:gap-4">
          <Link
            href="/courses"
            aria-label="Search courses"
            className={`${iconLinkClassName} hidden sm:block`}
          >
            <Search className="size-5" />
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart, ${cart.count} ${cart.count === 1 ? "item" : "items"}`}
            className={`${iconLinkClassName} relative`}
          >
            <ShoppingCart className="size-5" />
            {cart.count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] leading-4 font-bold text-white">
                {cart.count}
              </span>
            )}
          </Link>
          {user && panelHref ? (
            <UserMenu
              user={{ name: user.name, email: user.email, image: user.image }}
              panel={user.panel}
              panelHref={panelHref}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-gray-600 transition hover:text-blue-600 sm:block"
              >
                Login
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-blue-700 sm:px-6"
              >
                Sign Up
              </Link>
            </>
          )}
          <MobileMenu
            panelHref={panelHref}
            isStudent={user?.panel === "student"}
          />
        </div>
      </div>
    </header>
  );
}
