import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CircleCheck, OctagonX, ShieldAlert } from "lucide-react";
import { CertificateDesign } from "@/components/certificate/certificate-design";
import { PrintButton } from "@/components/certificate/print-button";
import { certificateConfig } from "@/lib/certificate-config";
import { normaliseCertificateCode } from "@/lib/course";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCertificateByCode } from "@/services/certificate";

// Individual certificates are for the person who holds the link, not for search engines.
export const metadata: Metadata = {
  title: "Certificate",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const TEN_MINUTES = 10 * 60;

async function siteOrigin() {
  if (process.env.BETTER_AUTH_URL) return new URL(process.env.BETTER_AUTH_URL).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

// The certificate and, for everyone with the link, its verification: valid
// ones show the printable design, revoked ones only say so.
export default async function CertificatePage({ params }: PageProps<"/certificates/[code]">) {
  const { code: rawCode } = await params;
  const code = normaliseCertificateCode(rawCode);
  if (!code) notFound();
  if (code !== rawCode) redirect(`/certificates/${code}`);

  const limited = await checkRateLimit("certificate-lookup", [{ scope: "ip", limit: 30, windowSeconds: TEN_MINUTES }]);
  if (limited) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 size-8 text-amber-600" aria-hidden />
        <h1 className="mb-1 text-lg font-bold text-navy">Too many lookups</h1>
        <p className="text-sm text-gray-700">{limited}</p>
      </div>
    );
  }

  const certificate = await getCertificateByCode(code);
  if (!certificate) notFound();

  if (certificate.revoked) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center sm:p-8">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <OctagonX className="size-8" aria-hidden />
        </span>
        <h1 className="mb-2 text-2xl font-extrabold text-red-700">This certificate has been revoked</h1>
        <p className="mb-4 text-sm text-gray-600">
          Certificate <span className="font-mono font-bold">{certificate.code}</span> was issued by {certificateConfig.organisationName} but is no longer valid.
        </p>
        <Link href="/certificates" className="text-sm font-semibold text-blue-600 hover:underline">
          Verify another certificate
        </Link>
      </div>
    );
  }

  const issuedOn = dateFormatter.format(certificate.issuedAt);
  const verifyUrl = `${await siteOrigin()}/certificates/${certificate.code}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section aria-labelledby="verification" className="rounded-2xl border border-green-200 bg-white p-6 print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 id="verification" className="flex items-center gap-2 text-xl font-extrabold text-green-700">
            <CircleCheck className="size-6" aria-hidden /> Valid certificate
          </h1>
          <PrintButton />
        </div>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold tracking-wider text-gray-400 uppercase">Issued to</dt>
            <dd className="font-semibold text-navy">{certificate.learnerName}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-wider text-gray-400 uppercase">Course</dt>
            <dd className="font-semibold text-navy">{certificate.courseTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-wider text-gray-400 uppercase">Completed</dt>
            <dd className="font-semibold text-navy">{issuedOn}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-wider text-gray-400 uppercase">Certificate ID</dt>
            <dd className="font-mono font-semibold text-navy">{certificate.code}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-gray-500">
          Issued by {certificateConfig.organisationName}. To save a copy, choose &ldquo;Save as PDF&rdquo; in the print window.
        </p>
      </section>

      <CertificateDesign
        learnerName={certificate.learnerName}
        courseTitle={certificate.courseTitle}
        issuedOn={issuedOn}
        code={certificate.code}
        verifyUrl={verifyUrl}
      />
    </div>
  );
}
