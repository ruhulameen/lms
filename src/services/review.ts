import "server-only";
import { db } from "@/lib/db";
import { publiclyVisibleWhere } from "@/lib/content-status";
import { Prisma } from "@/generated/prisma/client";
import { hasLearnerAccess } from "@/lib/learning";
import { logActivity } from "@/services/activity";
import { getCourseBySlug, type Course } from "@/services/course";

// Site-wide testimonials are still sample content from the design: they are not
// tied to a course, so there is no table for them yet.

const testimonials = [
  {
    name: "Sarah Johnson",
    avatar: "https://i.pravatar.cc/100?img=5",
    course: "Health & Social Care",
    quote:
      "The course was easy to follow and really boosted my confidence. I've now secured a job in care.",
  },
  {
    name: "James Carter",
    avatar: "https://i.pravatar.cc/100?img=12",
    course: "Health & Safety",
    quote:
      "Excellent support and well-structured content. I gained the skills I needed for my new role.",
  },
  {
    name: "Priya Sharma",
    avatar: "https://i.pravatar.cc/100?img=28",
    course: "Business Administration",
    quote:
      "Flexible, affordable and professional. EdX Learning made it so easy to study while working full-time.",
  },
];

export async function getTestimonials() {
  return testimonials;
}

export type CourseReview = {
  id: number;
  name: string;
  avatar: string | null;
  rating: number;
  quote: string;
  course: Course;
};

const SLIDER_LIMIT = 12;

// Approved learner reviews with a written comment, newest first, for the
// "Hear from our learners" slider. Only reviews of publicly visible courses.
export async function getCourseReviews(): Promise<CourseReview[]> {
  const rows = await db.courseReview.findMany({
    where: { status: "APPROVED", body: { not: null }, course: publiclyVisibleWhere(new Date()) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: SLIDER_LIMIT,
    select: {
      id: true,
      rating: true,
      body: true,
      user: { select: { name: true, image: true } },
      course: { select: { slug: true } },
    },
  });
  const reviews = await Promise.all(
    rows.map(async (row) => {
      const course = await getCourseBySlug(row.course.slug);
      const quote = row.body?.trim();
      return course && quote
        ? { id: row.id, name: row.user.name, avatar: row.user.image, rating: row.rating, quote, course }
        : null;
    }),
  );
  return reviews.filter((review) => review !== null);
}

export type MyCourseReview = {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

// The learner's own review of a course, whatever its moderation state.
export async function getMyCourseReview(userId: number, courseId: number): Promise<MyCourseReview | null> {
  return db.courseReview.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, rating: true, title: true, body: true, status: true },
  });
}

export type ReviewInput = { rating: number; title: string | null; body: string | null };

export type SaveReviewResult =
  | { ok: true; status: MyCourseReview["status"]; created: boolean }
  | { ok: false; error: string };

// One review per learner per course, editable. A new or changed review waits
// for moderation (PENDING); saving without changing anything keeps its state.
// Moderation (stage 3) reads CourseReview rows by status and sets APPROVED or
// REJECTED with moderatedById and moderatedAt.
export async function saveCourseReview(userId: number, courseSlug: string, input: ReviewInput): Promise<SaveReviewResult> {
  const course = await db.course.findUnique({ where: { slug: courseSlug }, select: { id: true, title: true } });
  if (!course) return { ok: false, error: "This course no longer exists." };

  const enrolment = await db.enrolment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { status: true },
  });
  if (!enrolment || !hasLearnerAccess(enrolment.status)) {
    return { ok: false, error: "Enrol in this course to review it." };
  }

  const existing = await db.courseReview.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { id: true, rating: true, title: true, body: true, status: true },
  });
  if (existing) {
    const unchanged = existing.rating === input.rating && existing.title === input.title && existing.body === input.body;
    if (unchanged) return { ok: true, status: existing.status, created: false };
    await db.courseReview.update({
      where: { id: existing.id },
      data: { ...input, status: "PENDING", moderatedById: null, moderatedAt: null },
    });
    await logActivity({
      userId,
      action: "review.update",
      entity: "course-review",
      entityId: existing.id,
      details: { course: course.title, rating: input.rating, from: existing.status },
    });
    return { ok: true, status: "PENDING", created: false };
  }

  try {
    const review = await db.courseReview.create({
      data: { userId, courseId: course.id, ...input, status: "PENDING" },
      select: { id: true },
    });
    await logActivity({
      userId,
      action: "review.submit",
      entity: "course-review",
      entityId: review.id,
      details: { course: course.title, rating: input.rating },
    });
  } catch (error) {
    // Submitted twice at once.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Your review was already saved. Reload the page to edit it." };
    }
    throw error;
  }
  return { ok: true, status: "PENDING", created: true };
}
