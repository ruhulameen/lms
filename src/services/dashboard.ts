import "server-only";
import { db } from "@/lib/db";
import { formatDateInput, type DateRange } from "@/lib/date-range";
import { listActivity } from "@/services/activity";

function postStatusCount(rows: { status: string; _count: { _all: number } }[], status: string) {
  return rows.find((r) => r.status === status)?._count._all ?? 0;
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
  ] = await Promise.all([
    db.user.count(),
    db.role.findMany({
      orderBy: { name: "asc" },
      select: { name: true, _count: { select: { users: true } } },
    }),
    db.user.groupBy({ by: ["status"], _count: { _all: true } }),
    db.user.count({ where: { createdAt: inRange } }),
    db.user.count({ where: { createdAt: { gte: range.previousFrom, lt: range.previousTo } } }),
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
  ]);

  const perDay = new Map<string, number>();
  for (let i = 0; i < range.days; i++) {
    const d = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate() + i);
    perDay.set(formatDateInput(d), 0);
  }
  for (const { createdAt } of signUpDates) {
    const key = formatDateInput(createdAt);
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

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
    signUpsPerDay: [...perDay].map(([date, count]) => ({ date, count })),
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
    },
  };
}
