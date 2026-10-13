import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getSettings } from "@/lib/settings-store";

// Certificates and their verification stand apart from the site: a slim bar
// (not printed) and the content. Individual certificates are not indexed.
export const metadata: Metadata = { title: "Certificate verification" };

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-gray-800">
      <header className="flex h-16 items-center border-b border-gray-200 bg-white px-4 sm:px-6 print:hidden">
        <Link href="/" className="flex items-center gap-2 rounded text-base font-extrabold text-navy outline-none focus-visible:ring-3 focus-visible:ring-blue-600/40">
          <GraduationCap className="size-6 text-blue-600" aria-hidden /> {getSettings().certificate.organisationName}
        </Link>
        <Link href="/certificates" className="ml-auto text-sm font-semibold text-blue-600 hover:underline">
          Verify a certificate
        </Link>
      </header>
      <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
