import { Ban, CircleCheck, Pause } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";

const statuses = {
  ACTIVE: { label: "Active", tone: "success", icon: CircleCheck },
  SUSPENDED: { label: "Suspended", tone: "warning", icon: Pause },
  BANNED: { label: "Banned", tone: "danger", icon: Ban },
} as const;

export function UserStatusBadge({ status }: { status: keyof typeof statuses }) {
  const s = statuses[status];
  return <StatusBadge label={s.label} tone={s.tone} icon={s.icon} />;
}
