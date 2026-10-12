import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { panelForRole } from "@/lib/panel";

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

export function can(user: CurrentUser, permission: string) {
  return user.role === SUPERUSER_ROLE || user.permissions.includes(permission);
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (!can(user, permission)) throw new Error("Forbidden");
  return user;
}
