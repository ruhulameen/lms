// Turns an activity row's JSON details into a short readable line for the
// actions the admin screens log; anything else falls back to key: value pairs.
type Details = Record<string, unknown> | null;

function list(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value ?? "");
}

export function describeActivity(action: string, raw: unknown): string {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw == null ? "" : String(raw);
  }
  const d = raw as NonNullable<Details>;

  switch (action) {
    case "user.role-change":
      return `Role changed from ${d.from ?? "none"} to ${d.to ?? "none"}`;
    case "user.suspend":
    case "user.ban":
    case "user.reactivate":
      return `Status changed from ${String(d.from ?? "").toLowerCase()} to ${String(d.to ?? "").toLowerCase()}`;
    case "user.create":
      return `Created ${d.email ?? "user"} as ${d.role ?? "no role"}`;
    case "user.update":
      return `Updated ${list(d.fields)}`;
    case "role.create":
      return `Created role ${d.name}`;
    case "role.delete":
      return `Deleted role ${d.name}`;
    case "role.update":
      return d.from !== d.to ? `Renamed ${d.from} to ${d.to}` : `Updated role ${d.to}`;
    case "role.permissions-update": {
      const parts = [];
      if (Array.isArray(d.added) && d.added.length) parts.push(`Added ${list(d.added)}`);
      if (Array.isArray(d.removed) && d.removed.length) parts.push(`Removed ${list(d.removed)}`);
      return `${d.role}: ${parts.join("; ") || "no change"}`;
    }
    case "post.create":
    case "post.duplicate":
    case "post.delete":
    case "post.submit-for-review":
    case "post.publish":
    case "post.schedule":
    case "post.unpublish":
    case "post.archive":
      return `"${d.title ?? "Untitled"}"`;
    case "post.update":
      return `"${d.title ?? "Untitled"}": updated ${list(d.fields)}`;
    case "post.restore":
      return `"${d.title ?? "Untitled"}": restored revision ${d.revision}`;
    case "blog-category.create":
    case "blog-tag.create":
      return `Created ${d.name}`;
    case "blog-category.update":
    case "blog-tag.update":
      return d.from !== d.to ? `Renamed ${d.from} to ${d.to}` : `Updated ${d.to}`;
    case "blog-category.delete":
    case "blog-tag.delete":
      return `Deleted ${d.name} (${d.posts ?? 0} post${d.posts === 1 ? "" : "s"} affected)`;
  }

  return Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

const formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const formatDateTime = (date: Date) => formatter.format(date);
export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
