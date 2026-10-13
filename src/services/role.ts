import "server-only";
import { db } from "@/lib/db";
import { isSystemRole } from "@/lib/roles";
import type { Prisma } from "@/generated/prisma/client";

export const ROLE_PAGE_SIZE = 15;
export const ROLE_SORT_KEYS = ["name", "people", "permissions"] as const;
export type RoleSortKey = (typeof ROLE_SORT_KEYS)[number];

// People shown on the role detail page before "View all".
const ROLE_PEOPLE_LIMIT = 10;

// Admin data: call only after requirePermission("role.view").
export async function listRoles(filters: { search?: string; sort: RoleSortKey; order: "asc" | "desc"; page: number }) {
  const search = filters.search?.trim();
  const where: Prisma.RoleWhereInput = search
    ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
    : {};
  const dir = filters.order;
  const orderBy: Prisma.RoleOrderByWithRelationInput[] = [
    filters.sort === "people"
      ? { users: { _count: dir } }
      : filters.sort === "permissions"
        ? { permissions: { _count: dir } }
        : { name: dir },
    { id: "asc" },
  ];

  const [roles, total] = await Promise.all([
    db.role.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * ROLE_PAGE_SIZE,
      take: ROLE_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { users: true, permissions: true } },
      },
    }),
    db.role.count({ where }),
  ]);
  const rows = roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    userCount: r._count.users,
    permissionCount: r._count.permissions,
    system: isSystemRole(r.name),
  }));
  return { rows, total, page: filters.page, pageSize: ROLE_PAGE_SIZE };
}

// Admin data: call only after requirePermission("role.view").
export async function getRoleDetail(id: number) {
  const role = await db.role.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
      users: {
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: ROLE_PEOPLE_LIMIT,
        select: { id: true, name: true, email: true, status: true },
      },
    },
  });
  if (!role) return null;
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    system: isSystemRole(role.name),
    keys: role.permissions.map((p) => p.permission.key),
    userCount: role._count.users,
    users: role.users,
  };
}
