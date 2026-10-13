import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getSettings } from "@/lib/settings-store";

// The uploaded logo from Settings > Site, or the name set in type beside a mark.
export function Logo() {
  const { name, tagline, logoUrl } = getSettings().site;
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- any size of upload, fitted by height
        <img src={logoUrl} alt={name} className="h-10 w-auto max-w-56 object-contain" />
      ) : (
        <>
          <span className="flex size-10 items-center justify-center rounded-lg bg-blue-900">
            <BookOpen className="size-6 text-white" />
          </span>
          <span className="flex flex-col">
            <span className="text-xl leading-tight font-bold text-navy">{name}</span>
            {tagline && <span className="hidden text-[10px] tracking-wider text-gray-500 sm:block">{tagline}</span>}
          </span>
        </>
      )}
    </Link>
  );
}
