"use client";

import { Printer } from "lucide-react";

// Opens the browser's print dialog, where the certificate can be printed or
// saved as a PDF. The print stylesheet hides everything but the certificate.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition outline-none hover:bg-blue-700 focus-visible:ring-3 focus-visible:ring-blue-600/40"
    >
      <Printer className="size-4" aria-hidden /> Print or save as PDF
    </button>
  );
}
