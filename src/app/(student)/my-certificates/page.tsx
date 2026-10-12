import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck } from "lucide-react";
import { CourseImage } from "@/components/site/course-card";
import { PageHeading } from "@/components/student/page-heading";
import { getCertificates } from "@/services/student";
import { requireUser } from "@/services/user";

export const metadata: Metadata = {
  title: "My Certificates",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function MyCertificatesPage() {
  const user = await requireUser();
  const certificates = await getCertificates(user.id);

  return (
    <>
      <PageHeading
        title="My Certificates"
        description={
          certificates.length === 1 ? "1 certificate earned." : `${certificates.length} certificates earned.`
        }
      />

      {certificates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Award className="size-7" aria-hidden />
          </span>
          <h2 className="mb-2 text-lg font-bold text-navy">No certificates yet</h2>
          <p className="mb-5 text-sm text-gray-500">Finish every lesson of a course and your certificate will appear here.</p>
          <Link
            href="/my-courses"
            className="inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Go to my courses
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="relative h-44 overflow-hidden">
                <CourseImage
                  course={certificate.course}
                  srcWidth={500}
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
                  {certificate.courseTitle}
                </h2>
                <p className="mb-4 text-xs text-gray-500">
                  Earned {dateFormatter.format(certificate.issuedAt)}
                </p>
                <p className="mb-4 rounded-lg bg-blue-50 p-2 text-center font-mono text-[10px] font-bold tracking-widest text-blue-600">
                  {certificate.code}
                </p>
                <Link
                  href={`/certificates/${certificate.code}`}
                  className="mt-auto block w-full rounded-lg bg-blue-600 py-2.5 text-center text-xs font-bold text-white transition hover:bg-blue-700"
                >
                  View certificate
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
