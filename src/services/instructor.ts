import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { manageableCoursesWhere } from "@/services/course-access";
import { listEnrolments } from "@/services/learners";
import type { CurrentUser } from "@/services/user";

// Orders whose lines count as sales: paid, or partly refunded (their refunded
// lines are left out by refundedAt). A fully refunded order has no line left.
const ORDER_STATUSES_WITH_SALES: ("PAID" | "PARTIALLY_REFUNDED")[] = ["PAID", "PARTIALLY_REFUNDED"];

// The instructor dashboard: only courses the user teaches or created. Sales
// are units and revenue (after coupons) of non-refunded lines of paid orders
// for those courses; no order, buyer or billing details are read.
export async function getInstructorDashboard(user: CurrentUser) {
  const scope = manageableCoursesWhere(user);
  const soldLines = { course: scope, refundedAt: null, order: { status: { in: ORDER_STATUSES_WITH_SALES } } } satisfies Prisma.OrderItemWhereInput;
  const [byStatus, learners, completions, rating, courses, recent, sold, soldByCourse] = await Promise.all([
    db.course.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    db.enrolment.count({ where: { course: scope, status: { not: "CANCELLED" } } }),
    db.enrolment.count({ where: { course: scope, status: "COMPLETED" } }),
    db.courseReview.aggregate({ where: { course: scope, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } }),
    db.course.findMany({
      where: scope,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 6,
      select: { id: true, title: true, status: true, publishAt: true, _count: { select: { enrolments: true } } },
    }),
    listEnrolments({ page: 1, pageSize: 6, sort: "enrolled", order: "desc" }, scope),
    db.orderItem.aggregate({ where: soldLines, _count: { _all: true }, _sum: { total: true } }),
    db.orderItem.groupBy({ by: ["courseId"], where: soldLines, _count: { _all: true }, _sum: { total: true } }),
  ]);
  const soldTitles = soldByCourse.length
    ? await db.course.findMany({ where: { id: { in: soldByCourse.map((r) => r.courseId) } }, select: { id: true, title: true } })
    : [];
  const titleOf = new Map(soldTitles.map((c) => [c.id, c.title]));
  const count = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
  return {
    totalCourses: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    drafts: count("DRAFT"),
    pendingReview: count("PENDING_REVIEW"),
    published: count("PUBLISHED"),
    learners,
    completions,
    averageRating: rating._avg.rating,
    ratingCount: rating._count._all,
    courses,
    recentEnrolments: recent.rows,
    sales: {
      units: sold._count._all,
      revenue: Number(sold._sum.total ?? 0),
      byCourse: soldByCourse
        .map((r) => ({ courseId: r.courseId, title: titleOf.get(r.courseId) ?? "Course", units: r._count._all, revenue: Number(r._sum.total ?? 0) }))
        .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
        .slice(0, 5),
    },
  };
}
