import { Award, GraduationCap } from "lucide-react";
import type { Settings } from "@/lib/settings-schema";

type CertificateDesignProps = {
  // Organisation, title, signatory and images, from Settings > Certificate.
  config: Settings["certificate"];
  learnerName: string;
  courseTitle: string;
  // Already formatted, e.g. "13 October 2026".
  issuedOn: string;
  code: string;
  verifyUrl: string;
};

// A4 landscape on paper; on screen it scales with the page width. Sizes are in
// container units (cqw) of the sheet, so the layout is the same at any size.
const printCss = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden; }
  .certificate-sheet, .certificate-sheet * { visibility: visible; }
  .certificate-sheet {
    position: fixed; inset: 0; width: 297mm !important; height: 210mm !important; max-width: none !important;
    margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; break-inside: avoid;
  }
}
`;

export function CertificateDesign({ config, learnerName, courseTitle, issuedOn, code, verifyUrl }: CertificateDesignProps) {
  return (
    <>
      <style>{printCss}</style>
      <div
        className="certificate-sheet relative mx-auto aspect-[297/210] w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white font-serif text-slate-800 shadow-xl"
        style={{ containerType: "inline-size" }}
      >
        <div className="absolute inset-[2.2cqw] border-[0.5cqw] border-[#0f2a5c]" aria-hidden />
        <div className="absolute inset-[3.4cqw] border-[0.15cqw] border-amber-500" aria-hidden />

        <div className="absolute inset-[5cqw] flex flex-col items-center justify-between text-center">
          <header className="flex flex-col items-center">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- an uploaded image sized by the layout
              <img src={config.logoUrl} alt={config.organisationName} className="h-[5cqw] w-auto" />
            ) : (
              <div className="flex items-center gap-[0.8cqw] text-[#0f2a5c]">
                <GraduationCap className="size-[3.6cqw]" aria-hidden />
                <span className="font-sans text-[2.6cqw] font-extrabold tracking-tight">{config.organisationName}</span>
              </div>
            )}
            <h1 className="mt-[1.6cqw] text-[4.4cqw] leading-none font-bold tracking-wide text-[#0f2a5c] uppercase">{config.title}</h1>
          </header>

          <section className="flex w-full flex-col items-center px-[3cqw]">
            <p className="text-[1.5cqw] text-slate-500 italic">This is to certify that</p>
            <p className="mt-[0.8cqw] max-w-full border-b-[0.15cqw] border-slate-300 px-[3cqw] pb-[0.6cqw] text-[5cqw] leading-tight font-bold break-words text-slate-900 italic">
              {learnerName}
            </p>
            <p className="mt-[1.4cqw] text-[1.5cqw] text-slate-500 italic">has successfully completed the course</p>
            <p className="mt-[0.8cqw] max-w-[85%] text-[2.7cqw] leading-tight font-bold break-words text-[#0f2a5c]">{courseTitle}</p>
          </section>

          <footer className="grid w-full grid-cols-3 items-end gap-[2cqw] px-[2cqw]">
            <div className="text-left">
              <p className="text-[1.7cqw] font-bold text-slate-800">{issuedOn}</p>
              <p className="mt-[0.3cqw] border-t-[0.12cqw] border-slate-400 pt-[0.4cqw] text-[1.2cqw] text-slate-500">Date of completion</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="flex size-[7cqw] items-center justify-center rounded-full border-[0.3cqw] border-amber-500 bg-amber-50 text-amber-600">
                <Award className="size-[3.8cqw]" aria-hidden />
              </span>
            </div>
            <div className="text-right">
              {config.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- an uploaded image sized by the layout
                <img src={config.signatureUrl} alt="" className="ml-auto h-[4cqw] w-auto" />
              ) : (
                <p className="text-[2.4cqw] leading-none text-[#0f2a5c] italic">{config.signatoryName}</p>
              )}
              <p className="mt-[0.3cqw] border-t-[0.12cqw] border-slate-400 pt-[0.4cqw] text-[1.2cqw] text-slate-500">
                {config.signatoryName}, {config.signatoryTitle}
              </p>
            </div>
          </footer>

          <p className="font-sans text-[1cqw] text-slate-500">
            Certificate ID <span className="font-mono font-bold text-slate-700">{code}</span> · Verify this certificate at {verifyUrl}
          </p>
        </div>
      </div>
    </>
  );
}
