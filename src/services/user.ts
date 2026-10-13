import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { panelForRole } from "@/lib/panel";
import type { Prisma, UserStatus } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/permissions";

// The `admin` role is a superuser: it passes every permission check.
const SUPERUSER_ROLE = "admin";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Cached per request, so pages, layouts and actions can all call it freely.
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: Number(session.user.id) },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      status: true,
      twoFactorEnabled: true,
      role: {
        select: {
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  // A suspended or banned user loses access even while their session is alive.
  if (!user || user.status !== "ACTIVE") return null;

  const role = user.role?.name ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    joinedAt: user.createdAt,
    twoFactorEnabled: user.twoFactorEnabled,
    role,
    panel: panelForRole(role),
    permissions: user.role?.permissions.map((rp) => rp.permission.key) ?? [],
  };
});

// Used right after sign-in, before the new session cookie is readable.
export async function getUserPanel(userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });
  return panelForRole(user?.role?.name ?? null);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: CurrentUser, permission: PermissionKey) {
  return user.role === SUPERUSER_ROLE || user.permissions.includes(permission);
}

// Denied access has two shapes; follow them in new code.
// - Pages, layouts and services: `await requirePermission(key)`. It calls
//   forbidden(), which renders app/(admin)/forbidden.tsx with a 403.
// - Server actions: `const auth = await authorizeAction(key)`; if `!auth.ok`
//   return `auth.result` (a typed { ok: false } the form shows as a message).
export async function requirePermission(permission: PermissionKey) {
  const user = await requireUser();
  if (!can(user, permission)) forbidden();
  return user;
}

export const FORBIDDEN_MESSAGE = "You do not have permission to do that.";

// Never redirects or throws, so actions can hand the failure back to the form.
export async function authorizeAction(permission: PermissionKey) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, result: { ok: false as const, error: "Your session has expired. Sign in again." } };
  }
  if (!can(user, permission)) {
    return { ok: false as const, result: { ok: false as const, error: FORBIDDEN_MESSAGE } };
  }
  return { ok: true as const, user };
}

export const USER_PAGE_SIZE = 15;

export const USER_SORT_KEYS = ["name", "email", "role", "status", "joined"] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];

export type UserListFilters = {
  search?: string;
  role?: string;
  status?: UserStatus;
  // "yes" / "no" filters; anything else means no filter.
  verified?: string;
  twoFactor?: string;
  // Employees: every account whose role is not `student` (no role included).
  excludeStudent?: boolean;
  sort: UserSortKey;
  order: "asc" | "desc";
  page: number;
};

// Admin data: call only after requirePermission("user.view").
export async function listUsers(filters: UserListFilters) {
  const search = filters.search?.trim();
  const where: Prisma.UserWhereInput = {
    status: filters.status,
    role: filters.role ? { name: filters.role } : undefined,
    // Accounts with no role count as employees, so test roleId as well.
    AND: filters.excludeStudent && !filters.role ? [{ OR: [{ roleId: null }, { role: { name: { not: "student" } } }] }] : undefined,
    emailVerified: filters.verified === "yes" ? true : filters.verified === "no" ? false : undefined,
    twoFactorEnabled: filters.twoFactor === "yes" ? true : filters.twoFactor === "no" ? false : undefined,
    OR: search
      ? [{ name: { contains: search } }, { email: { contains: search } }]
      : undefined,
  };
  const dir = filters.order;
  const orderBy: Prisma.UserOrderByWithRelationInput[] = [
    filters.sort === "role"
      ? { role: { name: dir } }
      : filters.sort === "joined"
        ? { createdAt: dir }
        : { [filters.sort]: dir },
    { id: "asc" },
  ];

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        role: { select: { name: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { rows, total, page: filters.page, pageSize: USER_PAGE_SIZE };
}

// Admin data: call only after requirePermission("user.view").
export async function getUserDetail(id: number) {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
      roleId: true,
      role: { select: { name: true } },
    },
  });
}

// Roles for selects and filters.
export async function listRoleOptions() {
  return db.role.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// Separate from getCurrentUser so the common session lookup stays unchanged.
export async function isEmailVerified(userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return user?.emailVerified ?? false;
}
