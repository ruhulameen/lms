// Notification types and how a list of them is grouped on the page. Pure, so
// client components and unit tests may import it.

export const notificationTypes = [
  "order.paid",
  "order.failed",
  "order.refunded",
  "course.assigned",
  "course.access-cancelled",
  "course.access-restored",
  "certificate.issued",
  "coupon.personal",
  "review.approved",
  "review.rejected",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

// Which icon and colour a type gets.
export type NotificationKind = "order" | "problem" | "course" | "certificate" | "offer" | "review";

export function notificationKind(type: string): NotificationKind {
  if (type === "order.failed" || type === "course.access-cancelled" || type === "review.rejected") return "problem";
  if (type.startsWith("order.")) return "order";
  if (type.startsWith("course.")) return "course";
  if (type.startsWith("certificate.")) return "certificate";
  if (type.startsWith("coupon.")) return "offer";
  return "review";
}

const DAY = 86_400_000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// "Today", "This week" (the six days before today) and "Earlier", in that
// order; empty groups are left out. Items keep their order inside a group.
export function groupByAge<T extends { createdAt: Date }>(items: readonly T[], now: Date): { group: string; items: T[] }[] {
  const today = startOfDay(now);
  const groups = [
    { group: "Today", items: [] as T[] },
    { group: "This week", items: [] as T[] },
    { group: "Earlier", items: [] as T[] },
  ];
  for (const item of items) {
    const at = item.createdAt.getTime();
    groups[at >= today ? 0 : at >= today - 6 * DAY ? 1 : 2].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

// "Just now", "5m ago", "3h ago", "2d ago", then the date.
export function timeAgo(date: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
