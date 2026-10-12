import { cn } from "@/lib/utils";

export function SectionBadge({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-600",
        className,
      )}
      {...props}
    />
  );
}
