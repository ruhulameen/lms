import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { LookupForm } from "@/components/certificate/lookup-form";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description: "Check that a certificate was issued by us and is still valid.",
};

export default function VerifyCertificatePage() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <ShieldCheck className="size-6" aria-hidden />
      </span>
      <h1 className="mb-2 text-2xl font-extrabold text-navy">Verify a certificate</h1>
      <p className="mb-6 text-sm text-gray-600">
        Enter the certificate ID printed at the bottom of the certificate, or scan or follow its verification link. You will see who it was issued to, for which course and when.
      </p>
      <LookupForm />
    </div>
  );
}
