import "server-only";
import { getCourseBySlug } from "@/services/course";

// Placeholder testimonials from the design, until reviews are stored.

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

const courseReviews = [
  {
    name: "Erick Guerrero",
    avatar: "https://i.pravatar.cc/150?img=11",
    courseSlug: "barista-training",
    quote:
      "For knowing absolutely nothing about being a Barista I found this course to be very informative. I definitely recommend this course for beginners.",
  },
  {
    name: "Zainab Rizwan",
    avatar: "https://i.pravatar.cc/150?img=32",
    courseSlug: "hr-audit",
    quote:
      "The HR Audit course was incredibly detailed and practical. It gave me the exact tools I needed to improve our company's HR processes.",
  },
  {
    name: "Sarah Johnson",
    avatar: "https://i.pravatar.cc/150?img=5",
    courseSlug: "health-and-social-care-level-3",
    quote:
      "The course was easy to follow and really boosted my confidence. I've now secured a job in care. Highly recommend EdX Learning!",
  },
  {
    name: "James Carter",
    avatar: "https://i.pravatar.cc/150?img=12",
    courseSlug: "health-and-safety-workplace",
    quote:
      "Excellent support and well-structured content. I gained the skills I needed for my new role. The tutors are incredibly helpful.",
  },
];

export async function getTestimonials() {
  return testimonials;
}

export async function getCourseReviews() {
  const reviews = await Promise.all(
    courseReviews.map(async ({ courseSlug, ...review }) => {
      const course = await getCourseBySlug(courseSlug);
      return course ? { ...review, course } : null;
    }),
  );
  return reviews.filter((review) => review !== null);
}

export type CourseReview = Awaited<ReturnType<typeof getCourseReviews>>[number];
