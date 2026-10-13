import "server-only";
import { isPaidStatus, orderStatuses, toPence, toPounds } from "@/lib/commerce";
import { fillBuckets, type DateRange } from "@/lib/date-range";
import { db } from "@/lib/db";
import { reportKeys, type Cell, type Report, type ReportKey } from "@/lib/report";
import { attributionLabel, sanitiseAttribution } from "@/lib/tracking";

// The four reports under /admin/analytics. Each returns the same shape (a few
// headline figures, an optional chart, some tables), which one page draws and
// one route exports as CSV. Call only after analytics.view is checked.
//
// Money follows the dashboard: an order counts in the period it was PLACED in,
// and revenue is what was paid minus what has since been refunded. Rows are
// added up in memory, which is fine for the tens of thousands of orders this
// site will see; past that these want SQL GROUP BYs.

const PAID = orderStatuses.filter(isPaidStatus);
const STUDENT = "student";

const percent = (part: number, whole: number) => (whole === 0 ? null : (part / whole) * 100);
const netPence = (order: { total: unknown; refundedTotal: unknown }) => toPence(Number(order.total)) - toPence(Number(order.refundedTotal));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// Groups rows by a key and keeps the groups in first-seen order.
function groupBy<T, K>(rows: readonly T[], key: (row: T) => K) {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}

export function isReportKey(value: string): value is ReportKey {
  return (reportKeys as readonly string[]).includes(value);
}

export function getReport(key: ReportKey, range: DateRange): Promise<Report> {
  return { sales: salesReport, courses: coursesReport, learners: learnersReport, marketing: marketingReport }[key](range);
}

// ---------------------------------------------------------------- sales

async function salesReport(range: DateRange): Promise<Report> {
  const [orders, previous] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: range.from, lt: range.to }, status: { in: PAID } },
      select: {
        createdAt: true,
        total: true,
        refundedTotal: true,
        discountTotal: true,
        couponCode: true,
        items: { select: { courseId: true, courseTitle: true, total: true, refundedAt: true, course: { select: { category: { select: { name: true } } } } } },
      },
    }),
    range.compare
      ? db.order.findMany({
          where: { createdAt: { gte: range.previousFrom, lt: range.previousTo }, status: { in: PAID } },
          select: { total: true, refundedTotal: true },
        })
      : null,
  ]);

  const gross = sum(orders.map((o) => toPence(Number(o.total))));
  const refunded = sum(orders.map((o) => toPence(Number(o.refundedTotal))));
  const discounts = sum(orders.map((o) => toPence(Number(o.discountTotal))));
  const before = previous && {
    gross: sum(previous.map((o) => toPence(Number(o.total)))),
    refunded: sum(previous.map((o) => toPence(Number(o.refundedTotal)))),
    orders: previous.length,
  };
  const average = (pence: number, count: number) => (count === 0 ? 0 : toPounds(Math.round(pence / count)));

  const series = (value: (o: (typeof orders)[number]) => number) => fillBuckets(range, orders.map((o) => ({ at: o.createdAt, value: value(o) })));
  const counts = series(() => 1);
  const grossSeries = series((o) => toPence(Number(o.total)));
  const refundSeries = series((o) => toPence(Number(o.refundedTotal)));

  const items = orders.flatMap((o) => o.items);
  const byCourse = [...groupBy(items, (i) => i.courseId).values()]
    .map((rows) => {
      const kept = rows.filter((r) => !r.refundedAt);
      return { title: rows[rows.length - 1].courseTitle, sold: kept.length, refunded: rows.length - kept.length, revenue: sum(kept.map((r) => toPence(Number(r.total)))) };
    })
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);
  const byCategory = [...groupBy(items.filter((i) => !i.refundedAt), (i) => i.course.category?.name ?? "No category").entries()]
    .map(([name, rows]) => ({ name, sold: rows.length, revenue: sum(rows.map((r) => toPence(Number(r.total)))) }))
    .sort((a, b) => b.revenue - a.revenue);
  const byCoupon = [...groupBy(orders.filter((o) => o.couponCode), (o) => o.couponCode!).entries()]
    .map(([code, rows]) => ({ code, orders: rows.length, discount: sum(rows.map((o) => toPence(Number(o.discountTotal)))), revenue: sum(rows.map(netPence)) }))
    .sort((a, b) => b.orders - a.orders);

  return {
    stats: [
      { label: "Revenue", value: { money: toPounds(gross - refunded) }, icon: "revenue", tone: "emerald", current: gross - refunded, previous: before ? before.gross - before.refunded : null, note: "After refunds" },
      { label: "Paid orders", value: orders.length, icon: "orders", tone: "blue", current: orders.length, previous: before?.orders ?? null },
      { label: "Average order value", value: { money: average(gross, orders.length) }, icon: "average", tone: "violet", current: average(gross, orders.length), previous: before ? average(before.gross, before.orders) : null },
      { label: "Refunds", value: { money: toPounds(refunded) }, icon: "refunds", tone: "rose", current: refunded, previous: before?.refunded ?? null, lowerIsBetter: true },
      { label: "Discounts given", value: { money: toPounds(discounts) }, icon: "discount", tone: "amber", note: "Through coupons" },
    ],
    chart: {
      title: "Revenue",
      description: "After refunds, by the date the order was placed.",
      name: "Revenue",
      money: true,
      type: "area",
      points: grossSeries.map((p, i) => ({ label: p.label, value: toPounds(p.value - refundSeries[i].value) })),
    },
    tables: [
      {
        key: "courses",
        title: "Best-selling courses",
        description: "Refunded sales are not counted in Sold or Revenue.",
        columns: [{ label: "Course" }, { label: "Sold", numeric: true }, { label: "Refunded", numeric: true }, { label: "Revenue", numeric: true }],
        rows: byCourse.map((c) => [c.title, c.sold, c.refunded, { money: toPounds(c.revenue) }]),
        empty: "No courses were sold in this period.",
      },
      {
        key: "categories",
        title: "Revenue by category",
        columns: [{ label: "Category" }, { label: "Sold", numeric: true }, { label: "Revenue", numeric: true }, { label: "Share", numeric: true }],
        rows: byCategory.map((c) => [c.name, c.sold, { money: toPounds(c.revenue) }, { percent: percent(c.revenue, sum(byCategory.map((x) => x.revenue))) }]),
        empty: "No courses were sold in this period.",
      },
      {
        key: "coupons",
        title: "Coupons used",
        columns: [{ label: "Code" }, { label: "Orders", numeric: true }, { label: "Discount given", numeric: true }, { label: "Revenue", numeric: true }],
        rows: byCoupon.map((c) => [c.code, c.orders, { money: toPounds(c.discount) }, { money: toPounds(c.revenue) }]),
        empty: "No coupon was used on a paid order in this period.",
      },
      {
        key: "by-period",
        title: range.bucket === "month" ? "Sales by month" : "Sales by day",
        columns: [{ label: range.bucket === "month" ? "Month" : "Day" }, { label: "Orders", numeric: true }, { label: "Gross", numeric: true }, { label: "Refunds", numeric: true }, { label: "Revenue", numeric: true }],
        rows: counts
          .map((p, i): Cell[] => [p.label, p.value, { money: toPounds(grossSeries[i].value) }, { money: toPounds(refundSeries[i].value) }, { money: toPounds(grossSeries[i].value - refundSeries[i].value) }])
          .reverse(),
        empty: "Nothing in this period.",
      },
    ],
  };
}

// ---------------------------------------------------------------- courses

async function coursesReport(range: DateRange): Promise<Report> {
  const inRange = { gte: range.from, lt: range.to };
  const inPrevious = { gte: range.previousFrom, lt: range.previousTo };
  const live = { status: { not: "CANCELLED" as const } };

  const [courses, enrolments, reviews, attempts, stuck, previousNew, previousCompleted] = await Promise.all([
    db.course.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.enrolment.findMany({ where: live, select: { courseId: true, status: true, enrolledAt: true, completedAt: true, progressPercent: true } }),
    db.courseReview.groupBy({ by: ["courseId"], where: { status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } }),
    db.quizAttempt.findMany({
      where: { submittedAt: inRange },
      select: { passed: true, percent: true, quiz: { select: { id: true, lesson: { select: { title: true, course: { select: { title: true } } } } } } },
    }),
    // Learners still on the course, by the lesson they last opened.
    db.enrolment.groupBy({ by: ["lastLessonId"], where: { status: "ACTIVE", lastLessonId: { not: null } }, _count: { _all: true }, orderBy: { _count: { lastLessonId: "desc" } }, take: 20 }),
    range.compare ? db.enrolment.count({ where: { ...live, enrolledAt: inPrevious } }) : null,
    range.compare ? db.enrolment.count({ where: { completedAt: inPrevious } }) : null,
  ]);

  const within = (date: Date | null) => date !== null && date >= range.from && date < range.to;
  const fresh = enrolments.filter((e) => within(e.enrolledAt));
  const completedNow = enrolments.filter((e) => within(e.completedAt));
  const completedEver = enrolments.filter((e) => e.status === "COMPLETED").length;
  const ratingByCourse = new Map(reviews.map((r) => [r.courseId, { average: r._avg.rating, count: r._count._all }]));
  const allRatings = sum(reviews.map((r) => (r._avg.rating ?? 0) * r._count._all));
  const ratingCount = sum(reviews.map((r) => r._count._all));
  const byCourse = groupBy(enrolments, (e) => e.courseId);

  const lessons = await db.lesson.findMany({
    where: { id: { in: stuck.map((s) => s.lastLessonId!).filter(Boolean) } },
    select: { id: true, title: true, course: { select: { title: true } }, module: { select: { title: true } } },
  });
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const courseRows = courses
    .map((course) => {
      const rows = byCourse.get(course.id) ?? [];
      const done = rows.filter((e) => e.status === "COMPLETED").length;
      const rating = ratingByCourse.get(course.id);
      return {
        title: course.title,
        fresh: rows.filter((e) => within(e.enrolledAt)).length,
        learners: rows.length,
        done,
        rate: percent(done, rows.length),
        progress: rows.length === 0 ? null : sum(rows.map((e) => e.progressPercent)) / rows.length,
        rating: rating?.average ?? null,
        reviews: rating?.count ?? 0,
      };
    })
    .sort((a, b) => b.fresh - a.fresh || b.learners - a.learners);

  const quizRows = [...groupBy(attempts, (a) => a.quiz.id).values()]
    .map((rows) => ({
      course: rows[0].quiz.lesson.course.title,
      quiz: rows[0].quiz.lesson.title,
      attempts: rows.length,
      passRate: percent(rows.filter((a) => a.passed).length, rows.length),
      average: sum(rows.map((a) => a.percent ?? 0)) / rows.length,
    }))
    .sort((a, b) => (a.passRate ?? 0) - (b.passRate ?? 0));

  return {
    stats: [
      { label: "New enrolments", value: fresh.length, icon: "enrolments", tone: "blue", current: fresh.length, previous: previousNew },
      { label: "Courses completed", value: completedNow.length, icon: "completed", tone: "emerald", current: completedNow.length, previous: previousCompleted },
      { label: "Completion rate", value: { percent: percent(completedEver, enrolments.length) }, icon: "rate", tone: "violet", note: "All enrolments, all time" },
      { label: "Average rating", value: ratingCount === 0 ? "No reviews" : `${(allRatings / ratingCount).toFixed(1)} / 5`, icon: "rating", tone: "amber", note: `${ratingCount} approved ${ratingCount === 1 ? "review" : "reviews"}` },
    ],
    chart: {
      title: "New enrolments",
      description: "Bought, free and assigned by staff.",
      name: "Enrolments",
      money: false,
      type: "column",
      points: fillBuckets(range, fresh.map((e) => ({ at: e.enrolledAt, value: 1 }))),
    },
    tables: [
      {
        key: "courses",
        title: "Courses",
        description: "New enrolments are for the chosen period; the other columns cover all time. Cancelled enrolments are left out.",
        columns: [
          { label: "Course" },
          { label: "New enrolments", numeric: true },
          { label: "Learners", numeric: true },
          { label: "Completed", numeric: true },
          { label: "Completion rate", numeric: true },
          { label: "Average progress", numeric: true },
          { label: "Rating", numeric: true },
          { label: "Reviews", numeric: true },
        ],
        rows: courseRows.map((c) => [c.title, c.fresh, c.learners, c.done, { percent: c.rate }, { percent: c.progress }, c.rating === null ? null : Number(c.rating.toFixed(1)), c.reviews]),
        empty: "There are no courses yet.",
      },
      {
        key: "stopped-at",
        title: "Where learners are now",
        description: "The lesson each learner who has not finished last opened. A lesson far from the end with many learners on it is where people get stuck.",
        columns: [{ label: "Course" }, { label: "Module" }, { label: "Lesson" }, { label: "Learners", numeric: true }],
        rows: stuck.flatMap((s): Cell[][] => {
          const lesson = lessonById.get(s.lastLessonId!);
          return lesson ? [[lesson.course.title, lesson.module.title, lesson.title, s._count._all]] : [];
        }),
        empty: "No learner is part-way through a course.",
      },
      {
        key: "quizzes",
        title: "Quizzes",
        description: "Attempts handed in during the period, hardest first.",
        columns: [{ label: "Course" }, { label: "Quiz" }, { label: "Attempts", numeric: true }, { label: "Pass rate", numeric: true }, { label: "Average score", numeric: true }],
        rows: quizRows.map((q) => [q.course, q.quiz, q.attempts, { percent: q.passRate }, { percent: q.average }]),
        empty: "No quiz was taken in this period.",
      },
    ],
  };
}

// ---------------------------------------------------------------- learners

async function learnersReport(range: DateRange): Promise<Report> {
  const inRange = { gte: range.from, lt: range.to };
  const students = { role: { name: STUDENT } };

  const [signUps, previousSignUps, orders, active, previousActive, buyers] = await Promise.all([
    db.user.findMany({ where: { ...students, createdAt: inRange }, select: { id: true, createdAt: true, _count: { select: { orders: { where: { status: { in: PAID } } } } } } }),
    range.compare ? db.user.count({ where: { ...students, createdAt: { gte: range.previousFrom, lt: range.previousTo } } }) : null,
    db.order.findMany({
      where: { createdAt: inRange, status: { in: PAID } },
      select: { userId: true, total: true, refundedTotal: true, user: { select: { name: true, email: true } } },
    }),
    // Opened or finished a lesson in the period.
    db.enrolment.findMany({ where: { progress: { some: { updatedAt: inRange } } }, distinct: ["userId"], select: { userId: true } }),
    range.compare
      ? db.enrolment.findMany({ where: { progress: { some: { updatedAt: { gte: range.previousFrom, lt: range.previousTo } } } }, distinct: ["userId"], select: { userId: true } })
      : null,
    // Every buyer ever, with how many paid orders each has.
    db.order.groupBy({ by: ["userId"], where: { status: { in: PAID } }, _count: { _all: true } }),
  ]);

  const converted = signUps.filter((u) => u._count.orders > 0).length;
  const repeat = buyers.filter((b) => b._count._all > 1).length;
  const spenders = [...groupBy(orders, (o) => o.userId).values()]
    .map((rows) => ({ name: rows[0].user.name, email: rows[0].user.email, orders: rows.length, spent: sum(rows.map(netPence)) }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 50);

  const signUpSeries = fillBuckets(range, signUps.map((u) => ({ at: u.createdAt, value: 1 })));
  const boughtSeries = fillBuckets(range, signUps.filter((u) => u._count.orders > 0).map((u) => ({ at: u.createdAt, value: 1 })));

  return {
    stats: [
      { label: "New sign-ups", value: signUps.length, icon: "signups", tone: "blue", current: signUps.length, previous: previousSignUps },
      { label: "Active learners", value: active.length, icon: "active", tone: "emerald", current: active.length, previous: previousActive?.length ?? null, note: "Studied in the period" },
      { label: "Sign-up to purchase", value: { percent: percent(converted, signUps.length) }, icon: "rate", tone: "violet", note: `${converted} of ${signUps.length} new sign-ups have bought` },
      { label: "Buyers in the period", value: new Set(orders.map((o) => o.userId)).size, icon: "buyers", tone: "amber" },
      { label: "Repeat buyers", value: { percent: percent(repeat, buyers.length) }, icon: "repeat", tone: "slate", note: `${repeat} of ${buyers.length} buyers, all time` },
    ],
    chart: { title: "New sign-ups", description: "Learner accounts created.", name: "Sign-ups", money: false, type: "column", points: signUpSeries },
    tables: [
      {
        key: "top-spenders",
        title: "Top spenders",
        description: "Orders placed in the period, after refunds. The top 50.",
        columns: [{ label: "Learner" }, { label: "Email" }, { label: "Orders", numeric: true }, { label: "Spent", numeric: true }],
        rows: spenders.map((s) => [s.name, s.email, s.orders, { money: toPounds(s.spent) }]),
        empty: "Nobody bought in this period.",
      },
      {
        key: "sign-ups",
        title: range.bucket === "month" ? "Sign-ups by month" : "Sign-ups by day",
        description: "\"Have bought\" counts those who placed a paid order at any time since.",
        columns: [{ label: range.bucket === "month" ? "Month" : "Day" }, { label: "Sign-ups", numeric: true }, { label: "Have bought", numeric: true }],
        rows: signUpSeries.map((p, i): Cell[] => [p.label, p.value, boughtSeries[i].value]).reverse(),
        empty: "Nothing in this period.",
      },
    ],
  };
}

// ---------------------------------------------------------------- marketing

async function marketingReport(range: DateRange): Promise<Report> {
  const inRange = { gte: range.from, lt: range.to };
  const [orders, signUps] = await Promise.all([
    db.order.findMany({ where: { createdAt: inRange, status: { in: PAID } }, select: { total: true, refundedTotal: true, attribution: true } }),
    db.user.findMany({ where: { role: { name: STUDENT }, createdAt: inRange }, select: { attribution: true } }),
  ]);

  const orderRows = orders.map((o) => ({ attribution: sanitiseAttribution(o.attribution), revenue: netPence(o) }));
  const signUpRows = signUps.map((u) => sanitiseAttribution(u.attribution));
  const total = sum(orderRows.map((o) => o.revenue));
  const tracked = orderRows.filter((o) => o.attribution?.source);

  const sources = new Map<string, { signUps: number; orders: number; revenue: number }>();
  const slot = (label: string) => {
    let entry = sources.get(label);
    if (!entry) sources.set(label, (entry = { signUps: 0, orders: 0, revenue: 0 }));
    return entry;
  };
  for (const attribution of signUpRows) slot(attributionLabel(attribution)).signUps++;
  for (const order of orderRows) {
    const entry = slot(attributionLabel(order.attribution));
    entry.orders++;
    entry.revenue += order.revenue;
  }
  const sourceRows = [...sources.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].signUps - a[1].signUps);

  const campaigns = [...groupBy(tracked.filter((o) => o.attribution!.campaign), (o) => `${o.attribution!.campaign}\n${attributionLabel(o.attribution)}`).entries()]
    .map(([key, rows]) => ({ campaign: key.split("\n")[0], source: key.split("\n")[1], orders: rows.length, revenue: sum(rows.map((r) => r.revenue)) }))
    .sort((a, b) => b.revenue - a.revenue);
  const best = sourceRows.find(([label]) => label !== "Direct");

  return {
    stats: [
      { label: "Revenue with a known source", value: { percent: percent(sum(tracked.map((o) => o.revenue)), total) }, icon: "rate", tone: "emerald", note: `${tracked.length} of ${orders.length} paid orders` },
      { label: "Sources", value: sourceRows.filter(([label]) => label !== "Direct").length, icon: "sources", tone: "blue" },
      { label: "Best source", value: best ? best[0] : "None yet", icon: "best", tone: "violet", note: best ? "By revenue" : undefined },
      { label: "Campaigns with sales", value: campaigns.length, icon: "campaign", tone: "amber" },
    ],
    tables: [
      {
        key: "sources",
        title: "By source",
        description:
          "Where the visitor came from when they signed up or ordered: the campaign tags on the link (utm_source, utm_medium), an ad click, or the site that linked here. \"Direct\" is everything else, including visitors who refused cookies and orders placed before tracking was switched on.",
        columns: [{ label: "Source / medium" }, { label: "Sign-ups", numeric: true }, { label: "Orders", numeric: true }, { label: "Revenue", numeric: true }, { label: "Share of revenue", numeric: true }],
        rows: sourceRows.map(([label, s]) => [label, s.signUps, s.orders, { money: toPounds(s.revenue) }, { percent: percent(s.revenue, total) }]),
        empty: "No sign-ups or paid orders in this period.",
      },
      {
        key: "campaigns",
        title: "By campaign",
        description: "Orders whose link carried a campaign name (utm_campaign).",
        columns: [{ label: "Campaign" }, { label: "Source / medium" }, { label: "Orders", numeric: true }, { label: "Revenue", numeric: true }],
        rows: campaigns.map((c) => [c.campaign, c.source, c.orders, { money: toPounds(c.revenue) }]),
        empty: "No paid order came from a tagged campaign in this period.",
      },
    ],
  };
}
