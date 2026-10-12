import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type ActivityInput = {
  userId?: number | null;
  // Dotted `entity.verb`, e.g. `user.suspend`, `auth.sign-in`.
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: Prisma.InputJsonValue;
};

async function requestIp() {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null
    );
  } catch {
    // Called outside a request (seed, scripts).
    return null;
  }
}

// Never throws: an audit-log failure must not break the action being logged.
export async function logActivity(input: ActivityInput) {
  try {
    await db.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId == null ? null : String(input.entityId),
        details: input.details,
        ipAddress: await requestIp(),
      },
    });
  } catch (error) {
    console.error("Failed to write activity log", error);
  }
}

export const ACTIVITY_PAGE_SIZE = 25;

export type ActivityFilters = {
  // Matches action, entity, entity ID, IP address, user name or email.
  search?: string;
  action?: string;
  entity?: string;
  userId?: number;
  // Inclusive day range.
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listActivity(filters: ActivityFilters = {}) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? ACTIVITY_PAGE_SIZE, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();

  const where: Prisma.ActivityLogWhereInput = {
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    userId: filters.userId,
    createdAt:
      filters.from || filters.to
        ? {
            gte: filters.from,
            lt: filters.to
              ? new Date(filters.to.getTime() + 24 * 60 * 60 * 1000)
              : undefined,
          }
        : undefined,
    OR: search
      ? [
          { action: { contains: search } },
          { entity: { contains: search } },
          { entityId: { contains: search } },
          { ipAddress: { contains: search } },
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
        ]
      : undefined,
  };

  const [rows, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        details: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.activityLog.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

// Distinct values for the action and entity filter selects.
export async function listActivityFilterOptions() {
  const [actions, entities] = await Promise.all([
    db.activityLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.activityLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  return {
    actions: actions.map((a) => a.action),
    entities: entities.map((e) => e.entity),
  };
}
