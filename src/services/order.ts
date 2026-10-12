import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { recalculateEnrolmentProgress } from "@/services/learning";

// Orders. This file holds what every stage needs: reading an order, writing to
// its timeline, and turning a paid order into enrolments. Stage 2a adds order
// creation and the Stripe session here (or beside it); stage 3 adds refunds.
// Money columns are Decimal(10,2) pounds in the database and numbers (pounds)
// in the shapes below; use toPence() from src/lib/commerce.ts for arithmetic.

type Client = Prisma.TransactionClient | typeof db;

// ---------------------------------------------------------------- reading

const orderInclude = {
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      courseId: true,
      courseTitle: true,
      unitPrice: true,
      discount: true,
      total: true,
      refundedAt: true,
      enrolmentId: true,
      course: { select: { slug: true } },
    },
  },
  payments: { orderBy: { id: "asc" } },
  refunds: { orderBy: { id: "asc" }, include: { items: true, createdBy: { select: { id: true, name: true } } } },
  events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { actor: { select: { id: true, name: true } } } },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// An order with its lines, payments, refunds and timeline, or null when it does
// not exist. `viewer` decides who may see it: its owner always, and anyone
// else only with `staff: true` (the caller has checked order.view). A
// non-owner without staff gets null, the same as an unknown number.
export async function getOrderByNumber(
  orderNumber: string,
  viewer: { userId: number; staff: boolean },
): Promise<OrderDetail | null> {
  const order = await db.order.findUnique({ where: { orderNumber }, include: orderInclude });
  if (!order) return null;
  return order.userId === viewer.userId || viewer.staff ? order : null;
}

// Same, by id, for staff screens and the webhook (no ownership check: callers
// must have authorised or verified the request).
export async function getOrderById(id: number, client: Client = db): Promise<OrderDetail | null> {
  return client.order.findUnique({ where: { id }, include: orderInclude });
}

// ---------------------------------------------------------------- timeline

export type OrderEventInput = {
  type: Prisma.OrderEventCreateManyInput["type"];
  message: string;
  actorId?: number | null;
  data?: Prisma.InputJsonValue;
};

// Appends to the timeline. Pass `tx` to make it part of a transaction.
export async function addOrderEvent(orderId: number, event: OrderEventInput, client: Client = db) {
  return client.orderEvent.create({
    data: {
      orderId,
      type: event.type,
      message: event.message,
      actorId: event.actorId ?? null,
      data: event.data,
    },
    select: { id: true },
  });
}

// ---------------------------------------------------------------- fulfilment

export type FulfilResult =
  | {
      ok: true;
      created: number[];
      reactivated: number[];
      // Courses the learner already had (active or completed): left alone.
      existing: number[];
      // Courses of lines already refunded: not enrolled.
      skipped: number[];
    }
  | { ok: false; error: string };

// Turns a paid order into enrolments, one per line (source ORDER), and links
// each to its order item. The only place that does this: the webhook and the
// free-order path both call it.
// - Idempotent: a second call changes nothing and adds no timeline event.
// - A learner who already has an active or completed enrolment keeps it as is
//   (the item is linked to it); a CANCELLED one is reactivated (COMPLETED if it
//   had been completed) with source ORDER; otherwise one is created.
// - Lines already refunded are skipped.
// The order row is locked for the call (SELECT ... FOR UPDATE), so two
// simultaneous calls run one after the other.
export async function fulfilOrder(orderId: number): Promise<FulfilResult> {
  const result = await db.$transaction(async (tx): Promise<FulfilResult & { reactivatedEnrolmentIds?: number[] }> => {
    await tx.$queryRaw`SELECT id FROM \`order\` WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        userId: true,
        items: { select: { id: true, courseId: true, courseTitle: true, enrolmentId: true, refundedAt: true } },
      },
    });
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status !== "PAID") return { ok: false, error: "Only a paid order can be fulfilled." };

    const created: number[] = [];
    const reactivated: number[] = [];
    const existing: number[] = [];
    const skipped: number[] = [];
    const reactivatedEnrolmentIds: number[] = [];
    let changed = false;

    for (const item of order.items) {
      if (item.refundedAt) {
        skipped.push(item.courseId);
        continue;
      }
      const enrolment = await tx.enrolment.findUnique({
        where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
        select: { id: true, status: true, completedAt: true },
      });

      let enrolmentId: number;
      if (!enrolment) {
        const row = await tx.enrolment.create({
          data: { userId: order.userId, courseId: item.courseId, source: "ORDER" },
          select: { id: true },
        });
        enrolmentId = row.id;
        created.push(item.courseId);
        changed = true;
      } else if (enrolment.status === "CANCELLED") {
        await tx.enrolment.update({
          where: { id: enrolment.id },
          data: { status: enrolment.completedAt ? "COMPLETED" : "ACTIVE", source: "ORDER" },
        });
        enrolmentId = enrolment.id;
        reactivated.push(item.courseId);
        reactivatedEnrolmentIds.push(enrolment.id);
        changed = true;
      } else {
        enrolmentId = enrolment.id;
        // Already linked on an earlier call: nothing to report.
        if (item.enrolmentId !== enrolment.id) existing.push(item.courseId);
      }

      if (item.enrolmentId !== enrolmentId) {
        await tx.orderItem.update({ where: { id: item.id }, data: { enrolmentId } });
        changed = true;
      }
    }

    if (changed) {
      const titles = new Map(order.items.map((i) => [i.courseId, i.courseTitle]));
      const names = (ids: number[]) => ids.map((id) => titles.get(id)).join(", ");
      const parts = [
        created.length ? `enrolled in ${names(created)}` : null,
        reactivated.length ? `access restored to ${names(reactivated)}` : null,
        existing.length ? `already enrolled in ${names(existing)}` : null,
      ].filter(Boolean);
      await addOrderEvent(
        order.id,
        { type: "ENROLLED", message: `Learner ${parts.join("; ")}.`, data: { created, reactivated, existing, skipped } },
        tx,
      );
    }
    return { ok: true, created, reactivated, existing, skipped, reactivatedEnrolmentIds };
  });

  // A reactivated enrolment may be complete already (lessons finished before it was cancelled).
  if (result.ok && result.reactivatedEnrolmentIds?.length) {
    for (const id of result.reactivatedEnrolmentIds) await recalculateEnrolmentProgress(id);
  }
  if (!result.ok) return result;
  const { created, reactivated, existing, skipped } = result;
  return { ok: true, created, reactivated, existing, skipped };
}

// ---------------------------------------------------------------- learner's list

// The learner's own orders, newest first, for My Orders.
export async function listOrdersForUser(userId: number) {
  return db.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      items: { orderBy: { id: "asc" }, select: { id: true, courseTitle: true } },
    },
  });
}

export type LearnerOrderRow = Awaited<ReturnType<typeof listOrdersForUser>>[number];
