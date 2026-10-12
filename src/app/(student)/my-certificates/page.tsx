import type { Metadata } from "next";
import Image from "next/image";
import { Award, BadgeCheck } from "lucide-react";
import { PageHeading, SampleNotice } from "@/components/student/page-heading";
import { unsplash } from "@/lib/format";
import { getCertificates } from "@/services/student";

export const metadata: Metadata = {
  title: "My Certificates",
};

export default async function MyCertificatesPage() {
  const certificates = await getCertificates();

  return (
    <>
      <PageHeading
        title="My Certificates"
        description={`${certificates.length} certificates earned.`}
      />
      <SampleNotice />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {certificates.map((certificate) => (
          <div
            key={certificate.id}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <div className="relative h-44 overflow-hidden">
              <Image
                src={unsplash(certificate.course.image, 500)}
                alt=""
                fill
                sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-blue-900/85 to-blue-600/75 text-center text-white">
                <div>
                  <Award className="mx-auto mb-2 size-10" />
                  <p className="text-[10px] font-black tracking-widest uppercase opacity-70">
                    Certificate of Completion
                  </p>
                </div>
              </div>
              <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black tracking-wider text-green-600 uppercase">
                <BadgeCheck className="size-3" /> Verified
              </span>
            </div>
            <div className="flex grow flex-col p-5">
              <h2 className="mb-2 text-base leading-snug font-bold text-navy">
                {certificate.course.title}
              </h2>
              <p className="mb-4 text-xs text-gray-500">
                Earned {certificate.earnedAt}
              </p>
              <p className="mb-4 rounded-lg bg-blue-50 p-2 text-center font-mono text-[10px] font-bold tracking-widest text-blue-600">
                {certificate.id}
              </p>
              <button
                type="button"
                disabled
                title="PDF certificates are not available yet"
                className="mt-auto w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Download PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
