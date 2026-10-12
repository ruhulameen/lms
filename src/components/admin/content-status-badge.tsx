import { StatusBadge } from "@/components/admin/status-badge";
import { contentStatusMeta, type ContentStatusValue } from "@/lib/content-status";

export function ContentStatusBadge({ status, className }: { status: ContentStatusValue; className?: string }) {
  const { label, tone } = contentStatusMeta[status];
  return <StatusBadge label={label} tone={tone} className={className} />;
}
