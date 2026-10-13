import "server-only";
import { db } from "@/lib/db";
import { isPaidStatus, orderStatuses, toPence, toPounds, type OrderStatusValue } from "@/lib/commerce";
import { averageProgress, completionRate, lastMonths, monthKey, netRevenue, percentOf, progressSpread } from "@/lib/course-insight";

// Figures for the admin course overview. Call after the permission check; the
// `learners` and `money` flags say which groups of figures the viewer may see,
// and a group they may not see comes back as null.

const paidStatuses = orderStatuses.filter(isPaidStatus);

export async function getCourseFacts(courseId: number) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishAt: true,
      publishedAt: true,
      price: true,
      level: true,
      instructor: { select: { id: true, name: true } },
      category: { select: { name: true } },
      _count: { select: { modules: true } },
    },
  });
  if (!course) return null;
  const lessons = await db.lesson.count({ where: { courseId, published: true } });
  return { ...course, price: Number(course.price), moduleCount: course._count.modules, lessonCount: lessons };
}

export async function getCourseLearnerInsight(courseId: number) {
  const now = new Date();
  const months = lastMonths(now);
  const [enrolments, cancelled, certificates, reviews, lessons, recentEnrolments, recentCertificates] = await Promise.all([
    db.enrolment.findMany({
      where: { courseId, status: { not: "CANCELLED" } },
      select: { status: true, source: true, progressPercent: true, enrolledAt: true },
    }),
    db.enrolment.count({ where: { courseId, status: "CANCELLED" } }),
    db.certificate.count({ where: { courseId, revokedAt: null } }),
    db.courseReview.aggregate({ where: { courseId, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } }),
    db.lesson.findMany({
      where: { courseId, published: true },
      orderBy: [{ module: { position: "asc" } }, { position: "asc" }, { id: "asc" }],
      select: { id: true, title: true, type: true, module: { select: { id: true, title: true } }, quiz: { select: { id: true } } },
    }),
    db.enrolment.findMany({
      where: { courseId },
      orderBy: [{ enrolledAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, status: true, source: true, enrolledAt: true, progressPercent: true, user: { select: { id: true, name: true } } },
    }),
    db.certificate.findMany({
      where: { courseId },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, code: true, issuedAt: true, revokedAt: true, learnerName: true, userId: true },
    }),
  ]);

  const progressRows = lessons.length
    ? await db.lessonProgress.groupBy({
        by: ["lessonId"],
        where: { lessonId: { in: lessons.map((l) => l.id) }, completedAt: { not: null }, enrolment: { status: { not: "CANCELLED" } } },
        _count: { _all: true },
      })
    : [];
  const doneByLesson = new Map(progressRows.map((r) => [r.lessonId, r._count._all]));

  const quizIds = lessons.flatMap((l) => (l.quiz ? [l.quiz.id] : []));
  const attempts = quizIds.length
    ? await db.quizAttempt.findMany({
        where: { quizId: { in: quizIds }, submittedAt: { not: null } },
        select: { quizId: true, enrolmentId: true, percent: true, passed: true },
      })
    : [];

  const total = enrolments.length;
  const completed = enrolments.filter((e) => e.status === "COMPLETED").length;
  const bySource = { FREE: 0, ADMIN: 0, ORDER: 0 };
  const perMonth = new Map(months.map((m) => [m, 0]));
  for (const e of enrolments) {
    bySource[e.source]++;
    const key = monthKey(e.enrolledAt);
    if (perMonth.has(key)) perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
  }

  const modules: { id: number; title: string; lessons: { id: number; title: string; type: string; done: number; percent: number }[] }[] = [];
  for (const lesson of lessons) {
    let group = modules.at(-1);
    if (!group || group.id !== lesson.module.id) {
      group = { id: lesson.module.id, title: lesson.module.title, lessons: [] };
      modules.push(group);
    }
    const done = doneByLesson.get(lesson.id) ?? 0;
    group.lessons.push({ id: lesson.id, title: lesson.title, type: lesson.type, done, percent: percentOf(done, total) });
  }

  const quizzes = lessons.flatMap((l) => {
    if (!l.quiz) return [];
    const mine = attempts.filter((a) => a.quizId === l.quiz!.id);
    const scored = mine.filter((a) => a.percent !== null);
    return [
      {
        lessonId: l.id,
        title: l.title,
        learners: new Set(mine.map((a) => a.enrolmentId)).size,
        attempts: mine.length,
        passRate: percentOf(mine.filter((a) => a.passed).length, mine.length),
        averageScore: scored.length ? Math.round(scored.reduce((s, a) => s + (a.percent ?? 0), 0) / scored.length) : null,
      },
    ];
  });

  return {
    enrolled: total,
    inProgress: total - completed,
    completed,
    completionRate: completionRate(completed, total),
    averageProgress: averageProgress(enrolments.map((e) => e.progressPercent)),
    cancelled,
    certificates,
    rating: reviews._avg.rating === null ? null : Math.round(reviews._avg.rating * 10) / 10,
    reviewCount: reviews._count._all,
    bySource,
    perMonth: months.map((m) => ({ date: m, count: perMonth.get(m) ?? 0 })),
    spread: progressSpread(enrolments.filter((e) => e.status !== "CANCELLED").map((e) => ({ status: e.status as "ACTIVE" | "COMPLETED", progressPercent: e.progressPercent }))),
    modules,
    quizzes,
    recentEnrolments,
    recentCertificates,
  };
}

// Revenue rule: an order line counts once its order is in a paid status (PAID,
// PARTIALLY_REFUNDED or REFUNDED: the buyer paid, whatever happened after).
// Revenue is the sum of this course's `OrderItem.total` on those orders (price
// less the coupon's share). Refunded is the sum of `RefundItem.amount` against
// those lines for refunds that SUCCEEDED (pending and failed refunds returned
// no money). Net = revenue - refunded. `OrderItem.refundedAt` only flags a
// refunded line; the amounts come from RefundItem.
export async function getCourseMoneyInsight(courseId: number) {
  const [revenue, refunded, recentOrders] = await Promise.all([
    db.orderItem.aggregate({ where: { courseId, order: { status: { in: paidStatuses } } }, _sum: { total: true } }),
    db.refundItem.aggregate({
      where: { refund: { status: "SUCCEEDED" }, orderItem: { courseId, order: { status: { in: paidStatuses } } } },
      _sum: { amount: true },
    }),
    db.order.findMany({
      where: { items: { some: { courseId } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        items: { where: { courseId }, select: { total: true } },
      },
    }),
  ]);
  const gross = toPounds(toPence(Number(revenue._sum.total ?? 0)));
  const returned = toPounds(toPence(Number(refunded._sum.amount ?? 0)));
  return {
    revenue: gross,
    refunded: returned,
    net: netRevenue(gross, returned),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status as OrderStatusValue,
      createdAt: o.createdAt,
      learner: o.user.name,
      lineTotal: Number(o.items[0]?.total ?? 0),
    })),
  };
}
