import "server-only";
import { db } from "@/lib/db";
import { manageableCoursesWhere } from "@/services/course-access";
import { listEnrolments } from "@/services/learners";
import type { CurrentUser } from "@/services/user";

// The instructor dashboard: only courses the user teaches or created.
export async function getInstructorDashboard(user: CurrentUser) {
  const scope = manageableCoursesWhere(user);
  const [byStatus, learners, completions, rating, courses, recent] = await Promise.all([
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
  ]);
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
  };
}
