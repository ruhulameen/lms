import "server-only";
import { db } from "@/lib/db";
import { getCatalogueExcluding, getCoursesByIds, type Course } from "@/services/course";
import { getResumeLessons } from "@/services/learning";

// The learner's own data: enrolments, progress and certificates come from the
// database. Offers and notifications below are still placeholders from the
// design (no tables yet).

export type LearnerEnrolment = {
  id: number;
  course: Course;
  progress: number;
  completed: boolean;
  enrolledAt: Date;
  completedAt: Date | null;
  // Where "Continue" goes; null when the course has no lessons.
  resume: { slug: string; title: string } | null;
  certificateCode: string | null;
};

// Not cancelled, in-progress courses first (most recently active first), then
// finished ones (most recently finished first).
export async function getEnrolments(userId: number): Promise<LearnerEnrolment[]> {
  const rows = await db.enrolment.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    select: {
      id: true,
      courseId: true,
      status: true,
      progressPercent: true,
      enrolledAt: true,
      completedAt: true,
      lastLessonId: true,
      updatedAt: true,
      certificate: { select: { code: true, revokedAt: true } },
    },
  });
  const [courses, resumes] = await Promise.all([
    getCoursesByIds(rows.map((r) => r.courseId)),
    getResumeLessons(rows.filter((r) => r.status === "ACTIVE" || r.status === "COMPLETED")),
  ]);
  const byId = new Map(courses.map((c) => [c.id, c]));

  const items = rows.flatMap((row) => {
    const course = byId.get(row.courseId);
    if (!course) return [];
    const completed = row.status === "COMPLETED";
    return [
      {
        sortKey: completed ? (row.completedAt ?? row.updatedAt) : row.updatedAt,
        item: {
          id: row.id,
          course,
          progress: row.progressPercent,
          completed,
          enrolledAt: row.enrolledAt,
          completedAt: row.completedAt,
          resume: resumes.get(row.id) ?? null,
          certificateCode: row.certificate && !row.certificate.revokedAt ? row.certificate.code : null,
        } satisfies LearnerEnrolment,
      },
    ];
  });
  items.sort(
    (a, b) =>
      Number(a.item.completed) - Number(b.item.completed) || b.sortKey.getTime() - a.sortKey.getTime(),
  );
  return items.map((i) => i.item);
}

export const resumeHref = (e: Pick<LearnerEnrolment, "course" | "resume">) =>
  e.resume ? `/learn/${e.course.slug}/${e.resume.slug}` : `/learn/${e.course.slug}`;

export async function getLearningSummary(userId: number, enrolments?: LearnerEnrolment[]) {
  const list = enrolments ?? (await getEnrolments(userId));
  const completed = list.filter((e) => e.completed).length;
  const [certificates, lessonsCompleted] = await Promise.all([
    db.certificate.count({ where: { userId, revokedAt: null } }),
    db.lessonProgress.count({ where: { completedAt: { not: null }, enrolment: { userId } } }),
  ]);
  return {
    enrolled: list.length,
    inProgress: list.length - completed,
    completed,
    certificates,
    lessonsCompleted,
  };
}

// Certificates the learner holds. Revoked ones are not listed. Stage 3 issues
// them; the certificate page is /certificates/<code>.
export async function getCertificates(userId: number) {
  const rows = await db.certificate.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    select: { id: true, code: true, issuedAt: true, courseId: true, courseTitle: true },
  });
  const courses = await getCoursesByIds([...new Set(rows.map((r) => r.courseId))]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  return rows.flatMap((row) => {
    const course = byId.get(row.courseId);
    return course ? [{ id: row.id, code: row.code, issuedAt: row.issuedAt, courseTitle: row.courseTitle, course }] : [];
  });
}

// Public courses the learner has not joined, most popular first.
export async function getStudentRecommendations(userId: number, enrolments?: LearnerEnrolment[]) {
  const list = enrolments ?? (await getEnrolments(userId));
  return getCatalogueExcluding(
    list.map((e) => e.course.id),
    3,
  );
}

function timeAgo(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// The latest lessons the learner finished.
export async function getRecentActivity(userId: number) {
  const rows = await db.lessonProgress.findMany({
    where: { completedAt: { not: null }, enrolment: { userId } },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: 5,
    select: { id: true, completedAt: true, lesson: { select: { title: true, course: { select: { title: true } } } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.lesson.title,
    detail: `${row.lesson.course.title} · ${timeAgo(row.completedAt!)}`,
  }));
}

export type Notification = {
  kind: "certificate" | "achievement" | "message" | "offer";
  title: string;
  description: string;
  time: string;
  unread: boolean;
};

export async function getNotifications(): Promise<
  { group: string; items: Notification[] }[]
> {
  return [
    {
      group: "Today",
      items: [
        { kind: "certificate", title: "Certificate ready for download", description: "Your Health & Safety certificate is now available.", time: "2h ago", unread: true },
        { kind: "achievement", title: "Achievement unlocked: 3-course streak!", description: "You completed 3 courses in a row.", time: "5h ago", unread: true },
      ],
    },
    {
      group: "This week",
      items: [
        { kind: "message", title: "Your tutor replied to your question", description: "“Great question — here's a worked example...”", time: "2d ago", unread: true },
        { kind: "offer", title: "New offer: 15% OFF sitewide", description: "Use code SAVE15NOW at checkout.", time: "3d ago", unread: false },
      ],
    },
    {
      group: "Earlier",
      items: [
        { kind: "certificate", title: "Course completed: Teaching Assistant Level 1–3", description: "Your certificate has been issued.", time: "1w ago", unread: false },
      ],
    },
  ];
}
