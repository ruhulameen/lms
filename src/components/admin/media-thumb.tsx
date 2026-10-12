import Image from "next/image";
import { File, FileText, Film, ImageOff } from "lucide-react";
import type { MediaSummary } from "@/lib/media-types";
import { cn } from "@/lib/utils";

type MediaThumbProps = {
  media: Pick<MediaSummary, "kind" | "url" | "altText" | "filename">;
  // Responsive `sizes` hint for next/image.
  sizes?: string;
  className?: string;
};

// Fills its parent: give the parent a size. Images use next/image; other kinds
// get an icon.
export function MediaThumb({ media, sizes = "200px", className }: MediaThumbProps) {
  if (media.kind === "IMAGE" && media.url) {
    return (
      <Image
        src={media.url}
        alt={media.altText ?? ""}
        fill
        sizes={sizes}
        className={cn("object-cover", className)}
      />
    );
  }
  const Icon = media.kind === "VIDEO" ? Film : media.kind === "IMAGE" ? ImageOff : media.kind === "PDF" ? FileText : File;
  return (
    <span className={cn("absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400", className)}>
      <Icon className="size-1/3 max-h-10 max-w-10 min-w-5" aria-hidden />
      <span className="sr-only">{media.filename}</span>
    </span>
  );
}
