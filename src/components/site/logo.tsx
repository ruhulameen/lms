import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-lg bg-blue-900">
        <BookOpen className="size-6 text-white" />
      </span>
      <span className="flex flex-col">
        <span className="text-xl leading-tight font-bold text-navy">
          EdX learning
        </span>
        <span className="hidden text-[10px] tracking-wider text-gray-500 sm:block">
          Learn Today · Build Tomorrow
        </span>
      </span>
    </Link>
  );
}
