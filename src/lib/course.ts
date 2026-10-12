import { formatPrice, unsplash } from "@/lib/format";

// Pure helpers for courses, shared by the services, pages and tests.

export const courseLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"] as const;
export type CourseLevelValue = (typeof courseLevels)[number];

export const courseLevelLabels: Record<CourseLevelValue, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All levels",
};

export const lessonTypes = ["VIDEO", "TEXT", "DOCUMENT", "QUIZ"] as const;
export type LessonTypeValue = (typeof lessonTypes)[number];

export const lessonTypeLabels: Record<LessonTypeValue, string> = {
  VIDEO: "Video",
  TEXT: "Text",
  DOCUMENT: "Document",
  QUIZ: "Quiz",
};

export const enrolmentSources = ["FREE", "ADMIN", "ORDER"] as const;
export const enrolmentStatuses = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const reviewStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export const questionTypes = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"] as const;

export const isFree = (price: number) => price <= 0;

// A course price as shown to people: "Free" for price 0, else "£49".
export const formatCoursePrice = (price: number) => (isFree(price) ? "Free" : formatPrice(price));

export const REVIEW_TITLE_MAX = 150;
export const REVIEW_BODY_MAX = 2000;

// Whole percent off, or null when there is no real "was" price.
export function discountPercent(price: number, compareAtPrice: number | null | undefined) {
  if (!compareAtPrice || compareAtPrice <= 0 || price < 0 || price >= compareAtPrice) return null;
  return Math.round((1 - price / compareAtPrice) * 100);
}

// "45 min", "1 hour", "1 hr 30 min", "10 hours". Null for no duration.
export function formatCourseDuration(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours} hr ${rest} min`;
}

// Lesson length as a player shows it: "4:05", "1:02:09".
export function formatLessonDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

// Whole minutes for a total of lesson seconds, at least 1 when there is any.
export function secondsToMinutes(seconds: number) {
  return seconds <= 0 ? 0 : Math.max(1, Math.round(seconds / 60));
}

// Completed lessons over all lessons as a whole percent, 0-100.
export function progressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

// Mean of ratings rounded to one decimal, or null when there are none.
export function averageRating(sum: number, count: number) {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
}

// Where a course image comes from: the chosen thumbnail, else the sample
// Unsplash photo, else nothing (callers draw a placeholder).
export function courseImageSrc(
  course: { imageUrl: string | null; externalImageId: string | null },
  width: number,
) {
  if (course.imageUrl) return course.imageUrl;
  return course.externalImageId ? unsplash(course.externalImageId, width) : null;
}

// Certificate codes: LMS-XXXX-XXXX-XXXX. The alphabet leaves out 0/O and 1/I/L
// so a code read aloud or copied by hand is not misread. 12 characters from 31
// symbols is about 6e17 combinations: unguessable, still short enough to type.
export const CERTIFICATE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CERTIFICATE_CODE_PATTERN = /^LMS-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

// `random` returns n random bytes; the default uses the platform's secure source.
export function generateCertificateCode(
  random: (length: number) => Uint8Array = (length) => crypto.getRandomValues(new Uint8Array(length)),
) {
  const chars: string[] = [];
  // Bytes at or above this would favour the first symbols; draw again.
  const limit = 256 - (256 % CERTIFICATE_ALPHABET.length);
  while (chars.length < 12) {
    for (const byte of random(16)) {
      if (byte < limit && chars.length < 12) chars.push(CERTIFICATE_ALPHABET[byte % CERTIFICATE_ALPHABET.length]);
    }
  }
  const code = chars.join("");
  return `LMS-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

// Accepts what a person might type (lower case, spaces, missing dashes) and
// returns the canonical code, or null when it cannot be one.
export function normaliseCertificateCode(input: string) {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith("LMS") ? compact.slice(3) : compact;
  if (body.length !== 12) return null;
  const code = `LMS-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
  return CERTIFICATE_CODE_PATTERN.test(code) ? code : null;
}
