import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones = {
  success: { icon: CircleCheck, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  warning: { icon: CircleAlert, className: "border-amber-200 bg-amber-50 text-amber-800" },
  danger: { icon: CircleX, className: "border-red-200 bg-red-50 text-red-800" },
  info: { icon: CircleDot, className: "border-blue-200 bg-blue-50 text-blue-800" },
  neutral: { icon: CircleDot, className: "border-slate-200 bg-slate-100 text-slate-700" },
} satisfies Record<string, { icon: LucideIcon; className: string }>;

export type StatusTone = keyof typeof tones;

type StatusBadgeProps = {
  // Text shown in the badge; the meaning never relies on colour alone.
  label: string;
  tone?: StatusTone;
  // Replaces the tone's default icon.
  icon?: LucideIcon;
  className?: string;
};

export function StatusBadge({
  label,
  tone = "neutral",
  icon,
  className,
}: StatusBadgeProps) {
  const Icon = icon ?? tones[tone].icon;
  return (
    <Badge variant="outline" className={cn("gap-1", tones[tone].className, className)}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
