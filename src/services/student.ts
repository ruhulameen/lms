import "server-only";
import { getCourseBySlug, getRecommendedCourses } from "@/services/course";

// Placeholder learner data from the design. Enrolments, certificates, offers
// and notifications have no tables yet, so every student sees this sample.

type SampleEnrolment = {
  slug: string;
  progress: number;
  nextLesson?: string;
  completedAt?: string;
  certificateId?: string;
};

const sampleEnrolments: SampleEnrolment[] = [
  { slug: "care-certificate-standards", progress: 65, nextLesson: "Module 3 · Safeguarding Adults" },
  { slug: "microsoft-office-skills", progress: 35, nextLesson: "Module 2 · Excel Formulas" },
  { slug: "health-and-safety-workplace", progress: 100, completedAt: "14 Sep 2025", certificateId: "SKL-CERT-4821" },
  { slug: "teaching-assistant-level-1-2-3", progress: 100, completedAt: "02 Sep 2025", certificateId: "SKL-CERT-4732" },
  { slug: "hr-audit", progress: 100, completedAt: "18 Aug 2025", certificateId: "SKL-CERT-4589" },
  { slug: "medical-administration", progress: 100, completedAt: "25 Jul 2025", certificateId: "SKL-CERT-4412" },
];

export async function getEnrolments() {
  const enrolments = await Promise.all(
    sampleEnrolments.map(async ({ slug, ...enrolment }) => {
      const course = await getCourseBySlug(slug);
      return course
        ? { ...enrolment, course, completed: enrolment.progress === 100 }
        : null;
    }),
  );
  return enrolments.filter((enrolment) => enrolment !== null);
}

export type Enrolment = Awaited<ReturnType<typeof getEnrolments>>[number];

export async function getLearningSummary() {
  const enrolments = await getEnrolments();
  const completed = enrolments.filter((e) => e.completed).length;
  return {
    enrolled: enrolments.length,
    inProgress: enrolments.length - completed,
    completed,
    certificates: enrolments.filter((e) => e.certificateId).length,
    learningHours: 42,
  };
}

export async function getCertificates() {
  const enrolments = await getEnrolments();
  return enrolments.flatMap((e) =>
    e.certificateId && e.completedAt
      ? { id: e.certificateId, earnedAt: e.completedAt, course: e.course }
      : [],
  );
}

export async function getStudentRecommendations() {
  const enrolled = new Set((await getEnrolments()).map((e) => e.course.slug));
  const courses = await getRecommendedCourses();
  return courses.filter((course) => !enrolled.has(course.slug)).slice(0, 3);
}

export async function getRecentActivity() {
  return [
    { kind: "lesson" as const, title: "Completed lesson", detail: "Care Certificate · 2h ago" },
    { kind: "certificate", title: "Earned certificate", detail: "Health & Safety · 1d ago" },
  ];
}

export async function getOffers() {
  return [
    { code: "WELCOME20", amount: "20%", title: "20% OFF Next Course", description: "Valid on any single course.", tone: "orange" as const },
    { code: "BUNDLE5", amount: "£5", title: "£5 OFF Any Bundle", description: "Min spend £30.", tone: "blue" as const },
    { code: "CERT25", amount: "25%", title: "25% OFF Certificate", description: "CPD certificate discount.", tone: "navy" as const },
  ];
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
