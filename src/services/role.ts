import "server-only";
import { db } from "@/lib/db";

// Student, instructor and admin drive panel routing and the superuser check,
// so they can be neither renamed nor deleted.
export const RESERVED_ROLES = ["student", "instructor", "admin"] as const;

export function isReservedRole(name: string) {
  return (RESERVED_ROLES as readonly string[]).includes(name);
}

// Roles that use the admin panel and so get a column in the permission matrix.
const NON_ADMIN_PANEL_ROLES = ["student", "instructor"];

// Admin data: call only after requirePermission("role.view").
export async function listRoles() {
  const roles = await db.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { users: true, permissions: true } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    userCount: r._count.users,
    permissionCount: r._count.permissions,
    reserved: isReservedRole(r.name),
  }));
}

export async function getPermissionMatrix() {
  const roles = await db.role.findMany({
    where: { name: { notIn: NON_ADMIN_PANEL_ROLES } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  // Admin first, since it is the fixed reference column.
  roles.sort((a, b) => Number(b.name === "admin") - Number(a.name === "admin") || a.name.localeCompare(b.name));
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    keys: r.permissions.map((p) => p.permission.key),
  }));
}
