import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { panelHome } from "@/lib/panel";
import { VerifyEmailBanner } from "@/components/student/verify-email-banner";
import { isEmailVerified, requireUser } from "@/services/user";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (user.panel !== "student") redirect(panelHome(user.panel));
  const verified = await isEmailVerified(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-gray-800">
      <SiteHeader />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-gray-500"
        >
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-navy">Student Portal</span>
        </nav>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          <StudentSidebar
            user={{ name: user.name, email: user.email, image: user.image }}
          />
          <main className="min-w-0">
            {!verified && <VerifyEmailBanner email={user.email} />}
            {children}
          </main>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
