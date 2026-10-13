import "server-only";
import { db } from "@/lib/db";
import type { NotificationType } from "@/lib/notification";

// In-panel notifications. Anything that happens to a person calls notify();
// their panel reads the list and the unread count.

export type NewNotification = {
  type: NotificationType;
  title: string;
  body?: string;
  // A path on this site, e.g. /my-orders/ORD-...
  link?: string;
};

// Never throws: a notification must not undo or fail the thing it reports.
export async function notify(userId: number | null | undefined, notification: NewNotification) {
  if (!userId) return;
  try {
    await db.notification.create({
      data: { userId, type: notification.type, title: notification.title, body: notification.body ?? null, link: notification.link ?? null },
    });
  } catch (error) {
    console.error(`[notification] ${notification.type} for user ${userId} was not saved`, error);
  }
}

export const NOTIFICATION_PAGE_SIZE = 30;

export async function listNotifications(userId: number, page = 1) {
  const current = Math.max(page, 1);
  const [rows, total, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (current - 1) * NOTIFICATION_PAGE_SIZE,
      take: NOTIFICATION_PAGE_SIZE,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { rows, total, unread, page: current, pages: Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE)) };
}

export async function countUnreadNotifications(userId: number) {
  return db.notification.count({ where: { userId, readAt: null } });
}

// Marks one of the person's own notifications read and returns where it leads.
export async function readNotification(userId: number, id: number) {
  const row = await db.notification.findFirst({ where: { id, userId }, select: { link: true, readAt: true } });
  if (!row) return null;
  if (!row.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return { link: row.link };
}

export async function readAllNotifications(userId: number) {
  const { count } = await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return count;
}
