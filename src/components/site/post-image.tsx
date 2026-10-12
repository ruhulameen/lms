import Image from "next/image";
import { Newspaper } from "lucide-react";
import type { BlogPost } from "@/services/blog";
import { cn } from "@/lib/utils";

type PostImageProps = {
  image: BlogPost["image"];
  sizes: string;
  preload?: boolean;
  className?: string;
};

// Fills its parent (give it a size and `relative`). Posts without a featured
// image get a neutral placeholder instead of a broken picture.
export function PostImage({ image, sizes, preload, className }: PostImageProps) {
  if (image) {
    return <Image src={image.url} alt={image.alt} fill sizes={sizes} preload={preload} className={cn("object-cover", className)} />;
  }
  return (
    <div aria-hidden className={cn("absolute inset-0 flex items-center justify-center bg-linear-to-br from-slate-100 to-slate-200", className)}>
      <Newspaper className="size-10 text-slate-300" />
    </div>
  );
}
