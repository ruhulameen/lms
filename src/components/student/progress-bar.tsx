import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 overflow-hidden rounded-full bg-slate-200", className)}
    >
      <div
        className="h-full rounded-full bg-blue-600"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
