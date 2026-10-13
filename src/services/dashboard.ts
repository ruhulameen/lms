import "server-only";
import { db } from "@/lib/db";
import { fillBuckets, type DateRange } from "@/lib/date-range";
import { isPaidStatus, orderStatuses, toPence, toPounds } from "@/lib/commerce";
import { listActivity } from "@/services/activity";
import { getOrderSummary } from "@/services/order-admin";

function postStatusCount(rows: { status: string; _count: { _all: number } }[], status: string) {
  return rows.find((r) => r.status === status)?._count._all ?? 0;
}

// Where "All time" starts: the oldest account, order or enrolment.
export async function getEarliestRecordDate() {
  const [user, order, enrolment] = await Promise.all([
    db.user.aggregate({ _min: { createdAt: true } }),
    db.order.aggregate({ _min: { createdAt: true } }),
    db.enrolment.aggregate({ _min: { enrolledAt: true } }),
  ]);
  const dates = [user._min.createdAt, order._min.createdAt, enrolment._min.enrolledAt].filter((d): d is Date => d !== null);
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
}

// Admin data: call only after requirePermission("dashboard.view"). Content
// counts are only queried for the parts the viewer may see.
export async function getDashboard(
  range: DateRange,
  includeActivity: boolean,
  include: { posts: boolean; media: boolean; courses?: boolean; enrolments?: boolean; certificates?: boolean; reviews?: boolean } = {
    posts: false,
    media: false,
  },
) {
  const inRange = { gte: range.from, lt: range.to };
  const inPrevious = { gte: range.previousFrom, lt: range.previousTo };

  const [
    totalUsers,
    byRole,
    byStatus,
    signUps,
    previousSignUps,
    signUpDates,
    recentUsers,
    activity,
    postsByStatus,
    mediaCount,
    courseCounts,
    activeEnrolments,
    completions,
    certificateCount,
    pendingReviews,
    newEnrolments,
    previousEnrolments,
  ] = await Promise.all([
    db.user.count(),
    db.role.findMany({
      orderBy: { name: "asc" },
      select: { name: true, _count: { select: { users: true } } },
    }),
    db.user.groupBy({ by: ["status"], _count: { _all: true } }),
    db.user.count({ where: { createdAt: inRange } }),
    range.compare ? db.user.count({ where: { createdAt: inPrevious } }) : null,
    db.user.findMany({ where: { createdAt: inRange }, select: { createdAt: true } }),
    db.user.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true, role: { select: { name: true } } },
    }),
    includeActivity ? listActivity({ pageSize: 6 }) : null,
    include.posts ? db.blogPost.groupBy({ by: ["status"], _count: { _all: true } }) : null,
    include.media ? db.media.count({ where: { uploadStatus: "READY" } }) : null,
    include.courses ? db.course.groupBy({ by: ["status"], _count: { _all: true } }) : null,
    include.enrolments ? db.enrolment.count({ where: { status: "ACTIVE" } }) : null,
    include.enrolments ? db.enrolment.count({ where: { status: "COMPLETED" } }) : null,
    include.certificates ? db.certificate.count({ where: { revokedAt: null } }) : null,
    include.reviews ? db.courseReview.count({ where: { status: "PENDING" } }) : null,
    include.enrolments ? db.enrolment.count({ where: { enrolledAt: inRange } }) : null,
    include.enrolments && range.compare ? db.enrolment.count({ where: { enrolledAt: inPrevious } }) : null,
  ]);

  const statusCount = (status: string) =>
    byStatus.find((s) => s.status === status)?._count._all ?? 0;

  return {
    totalUsers,
    byRole: byRole.map((r) => ({ name: r.name, count: r._count.users })),
    byStatus: {
      ACTIVE: statusCount("ACTIVE"),
      SUSPENDED: statusCount("SUSPENDED"),
      BANNED: statusCount("BANNED"),
    },
    signUps,
    previousSignUps,
    // Per day, or per month for long ranges (range.bucket).
    signUpSeries: fillBuckets(range, signUpDates.map((u) => ({ at: u.createdAt, value: 1 }))),
    recentUsers,
    recentActivity: activity?.rows ?? null,
    content: {
      posts: postsByStatus
        ? {
            published: postStatusCount(postsByStatus, "PUBLISHED"),
            scheduled: postStatusCount(postsByStatus, "SCHEDULED"),
            pendingReview: postStatusCount(postsByStatus, "PENDING_REVIEW"),
            drafts: postStatusCount(postsByStatus, "DRAFT"),
          }
        : null,
      media: mediaCount,
    },
    learning: {
      courses: courseCounts
        ? { total: courseCounts.reduce((sum, c) => sum + c._count._all, 0), published: postStatusCount(courseCounts, "PUBLISHED") }
        : null,
      activeEnrolments,
      completions,
      certificates: certificateCount,
      pendingReviews,
      newEnrolments,
      previousEnrolments,
    },
  };
}

// Commerce numbers for the admin dashboard: call only after order.view is
// checked. All of it is about orders PLACED in the range (by creation date):
// - revenue = paid orders' totals minus what has been refunded on them;
// - paid orders = orders that are paid, partially refunded or refunded;
// - average order value = gross paid total / paid orders (before refunds);
// - refunds = refunded totals of those orders;
// - revenue series = the same revenue, per day (or month) the order was placed;
// - previous = the same figures for the period before, null for All time.
export async function getCommerceDashboard(range: DateRange) {
  const [summary, previous, paidOrders, latest] = await Promise.all([
    getOrderSummary({ from: range.from, to: range.to }),
    range.compare ? getOrderSummary({ from: range.previousFrom, to: range.previousTo }) : null,
    db.order.findMany({
      where: { createdAt: { gte: range.from, lt: range.to }, status: { in: orderStatuses.filter(isPaidStatus) } },
      select: { createdAt: true, total: true, refundedTotal: true },
    }),
    db.order.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  const series = fillBuckets(
    range,
    paidOrders.map((o) => ({ at: o.createdAt, value: toPence(Number(o.total)) - toPence(Number(o.refundedTotal)) })),
  );

  const grossPence = toPence(summary.paidTotal);
  const refundedPence = toPence(summary.refundedTotal);
  return {
    paidOrders: summary.paidOrders,
    revenue: toPounds(grossPence - refundedPence),
    refunds: summary.refundedTotal,
    averageOrderValue: summary.paidOrders === 0 ? 0 : toPounds(Math.round(grossPence / summary.paidOrders)),
    // In pounds.
    revenueSeries: series.map((p) => ({ ...p, value: toPounds(p.value) })),
    previous: previous
      ? {
          paidOrders: previous.paidOrders,
          revenue: toPounds(toPence(previous.paidTotal) - toPence(previous.refundedTotal)),
          refunds: previous.refundedTotal,
          averageOrderValue: previous.paidOrders === 0 ? 0 : toPounds(Math.round(toPence(previous.paidTotal) / previous.paidOrders)),
        }
      : null,
    latestOrders: latest.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, total: Number(o.total), createdAt: o.createdAt, learner: o.user.name })),
  };
}
