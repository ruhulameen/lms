import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { summariseOrders } from "@/lib/learner-insight";

// Everything the learner detail page shows beyond the enrolment table. Call
// after the permission checks: enrolment.view for the learning figures,
// order.view for the money ones. A courseScope (manageableCoursesWhere) limits
// the learning figures to those courses, as on the learner list.

const num = (value: { toString(): string } | null | undefined) => Number(value ?? 0);
const hasScope = (scope?: Prisma.CourseWhereInput) => (scope && Object.keys(scope).length > 0 ? scope : undefined);

// Account facts the user record does not hold: the latest sign-in.
export async function getLastSignIn(userId: number) {
  const latest = await db.session.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  return latest?.createdAt ?? null;
}

export type LearningSummary = { courses: number; completed: number; averageProgress: number; certificates: number };

export async function getLearningSummary(userId: number, courseScope?: Prisma.CourseWhereInput): Promise<LearningSummary> {
  const scope = hasScope(courseScope);
  const where: Prisma.EnrolmentWhereInput = { userId, status: { not: "CANCELLED" }, ...(scope ? { course: scope } : {}) };
  const [byStatus, average, certificates] = await Promise.all([
    db.enrolment.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.enrolment.aggregate({ where, _avg: { progressPercent: true } }),
    db.certificate.count({ where: { userId, revokedAt: null, ...(scope ? { course: scope } : {}) } }),
  ]);
  return {
    courses: byStatus.reduce((sum, g) => sum + g._count._all, 0),
    completed: byStatus.find((g) => g.status === "COMPLETED")?._count._all ?? 0,
    averageProgress: Math.round(average._avg.progressPercent ?? 0),
    certificates,
  };
}

export type LearnerCertificate = {
  id: number;
  code: string;
  courseTitle: string;
  issuedAt: Date;
  revoked: boolean;
};

export async function listLearnerCertificates(userId: number, courseScope?: Prisma.CourseWhereInput): Promise<LearnerCertificate[]> {
  const scope = hasScope(courseScope);
  const rows = await db.certificate.findMany({
    where: { userId, ...(scope ? { course: scope } : {}) },
    orderBy: { issuedAt: "desc" },
    select: { id: true, code: true, courseTitle: true, issuedAt: true, revokedAt: true },
  });
  return rows.map((c) => ({ id: c.id, code: c.code, courseTitle: c.courseTitle, issuedAt: c.issuedAt, revoked: c.revokedAt !== null }));
}

// ---------------------------------------------------------------- money

export const LEARNER_ORDER_LIMIT = 20;

export type LearnerOrderRow = {
  id: number;
  orderNumber: string;
  createdAt: Date;
  courses: string[];
  couponCode: string | null;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  total: number;
  refunded: number;
  paidAt: Date | null;
  // From the successful payment: "Visa" and "4242", null for a free or unpaid order.
  cardBrand: string | null;
  cardLast4: string | null;
};

export type LearnerRefundRow = {
  id: number;
  createdAt: Date;
  orderId: number;
  orderNumber: string;
  amount: number;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  reason: string | null;
  courses: string[];
};

// Figures over every order the learner placed (grouped in the database), the
// newest orders, and their refunds. Needs order.view.
export async function getLearnerMoney(userId: number) {
  const [groups, orders, refunds] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { userId }, _count: { _all: true }, _sum: { total: true, refundedTotal: true } }),
    db.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LEARNER_ORDER_LIMIT,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        couponCode: true,
        status: true,
        total: true,
        refundedTotal: true,
        items: { orderBy: { id: "asc" }, select: { courseTitle: true } },
        payments: { where: { status: "SUCCEEDED" }, orderBy: { id: "asc" }, take: 1, select: { paidAt: true, cardBrand: true, cardLast4: true } },
      },
    }),
    db.refund.findMany({
      where: { order: { userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LEARNER_ORDER_LIMIT,
      select: {
        id: true,
        createdAt: true,
        amount: true,
        status: true,
        reason: true,
        order: { select: { id: true, orderNumber: true } },
        items: { select: { orderItem: { select: { courseTitle: true } } } },
      },
    }),
  ]);
  const insight = summariseOrders(groups.map((g) => ({ status: g.status, total: num(g._sum.total), refundedTotal: num(g._sum.refundedTotal), count: g._count._all })));

  const orderRows: LearnerOrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    courses: o.items.map((i) => i.courseTitle),
    couponCode: o.couponCode,
    status: o.status,
    total: num(o.total),
    refunded: num(o.refundedTotal),
    paidAt: o.payments[0]?.paidAt ?? null,
    cardBrand: o.payments[0]?.cardBrand ?? null,
    cardLast4: o.payments[0]?.cardLast4 ?? null,
  }));
  const refundRows: LearnerRefundRow[] = refunds.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    orderId: r.order.id,
    orderNumber: r.order.orderNumber,
    amount: num(r.amount),
    status: r.status,
    reason: r.reason,
    courses: r.items.map((i) => i.orderItem.courseTitle),
  }));
  return { insight, orders: orderRows, refunds: refundRows };
}

// ---------------------------------------------------------------- reviews

export type LearnerReviewRow = {
  id: number;
  courseId: number;
  courseTitle: string;
  rating: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  excerpt: string;
};

const excerpt = (title: string | null, body: string | null) => {
  const text = [title, body].filter(Boolean).join(" - ");
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
};

export async function listLearnerReviews(userId: number, courseScope?: Prisma.CourseWhereInput): Promise<LearnerReviewRow[]> {
  const scope = hasScope(courseScope);
  const rows = await db.courseReview.findMany({
    where: { userId, ...(scope ? { course: scope } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, title: true, body: true, status: true, createdAt: true, course: { select: { id: true, title: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    courseId: r.course.id,
    courseTitle: r.course.title,
    rating: r.rating,
    status: r.status,
    createdAt: r.createdAt,
    excerpt: excerpt(r.title, r.body),
  }));
}
