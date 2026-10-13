import { TrackEvent } from "@/components/site/tracking";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, FileText, HelpCircle, Lock, PlayCircle, Type, type LucideIcon } from "lucide-react";
import { addToCart, buyNow } from "@/actions/cart";
import { enrolInCourse } from "@/actions/enrolment";
import { CourseCard, CourseImage } from "@/components/site/course-card";
import { CourseReviewForm } from "@/components/site/course-review-form";
import { RichText } from "@/components/site/rich-text";
import { Stars } from "@/components/site/stars";
import { UserAvatar } from "@/components/site/user-avatar";
import { ProgressBar } from "@/components/student/progress-bar";
import { courseLevelLabels, discountPercent, formatCoursePrice, formatLessonDuration, isFree, type LessonTypeValue } from "@/lib/course";
import { descriptionBelowLead } from "@/lib/course-overview";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getApprovedCourseReviews, getCourseDetail, getRelatedCourses } from "@/services/course";
import { getLearnerCourseState, learnerCanLearn } from "@/services/enrolment";
import { getMyCourseReview } from "@/services/review";
import { getCurrentUser } from "@/services/user";

type CoursePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enrol?: string }>;
};

const enrolMessages: Record<string, string> = {
  unavailable: "You could not be enrolled in this course. If you were enrolled before, contact support.",
  limited: "Too many attempts. Try again in a few minutes.",
};

const lessonIcons: Record<LessonTypeValue, LucideIcon> = {
  VIDEO: PlayCircle,
  TEXT: Type,
  DOCUMENT: FileText,
  QUIZ: HelpCircle,
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseDetail(slug);
  if (!course) return { title: "Course not found" };

  const title = course.seo?.title || course.title;
  const description = course.seo?.metaDescription || course.shortDescription || course.subtitle || undefined;
  const image = course.seo?.socialImageUrl ?? course.imageUrl ?? undefined;
  return {
    metadataBase: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : undefined,
    title,
    description,
    alternates: { canonical: course.seo?.canonicalUrl || `/courses/${course.slug}` },
    robots: course.seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description, images: image ? [image] : undefined },
  };
}

export default async function CoursePage({ params, searchParams }: CoursePageProps) {
  const { slug } = await params;
  const { enrol } = await searchParams;
  const course = await getCourseDetail(slug);
  if (!course) notFound();
  const user = await getCurrentUser();
  const [reviews, related, { enrolment, completedLessonIds }, myReview] = await Promise.all([
    getApprovedCourseReviews(course.id),
    getRelatedCourses(course),
    getLearnerCourseState(user?.id ?? null, course.id),
    user ? getMyCourseReview(user.id, course.id) : null,
  ]);
  const enrolled = learnerCanLearn(enrolment);
  const completed = new Set(completedLessonIds);
  const free = isFree(course.price);

  const price = formatCoursePrice(course.price);
  const discount = free ? null : discountPercent(course.price, course.oldPrice);
  // The short description leads; the full description follows without repeating it.
  const lead = course.shortDescription?.trim() || null;
  const description = descriptionBelowLead(course.description, lead);

  const details = [
    { label: "Price", value: price },
    { label: "Study method", value: "Online, self-paced" },
    { label: "Duration", value: course.duration ?? "Self-paced" },
    { label: "Level", value: courseLevelLabels[course.level] },
    { label: "Language", value: course.language },
    { label: "Category", value: course.category },
    { label: "Lessons", value: String(course.lessonCount) },
  ];

  return (
    <>
      <TrackEvent payload={{ event: "view_item", value: course.price, items: [{ id: String(course.id), name: course.title, price: course.price, category: course.category ?? undefined }] }} />
      <div className="border-b border-gray-100 bg-white">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-gray-500 sm:px-6 lg:px-8"
        >
          <Link href="/" className="transition hover:text-blue-600">
            Home
          </Link>
          <span>/</span>
          <Link href="/courses" className="transition hover:text-blue-600">
            Courses
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-gray-800">
            {course.title}
          </span>
        </nav>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="lg:col-span-2">
          <h1 className="mb-4 text-2xl leading-tight font-extrabold text-navy">
            {course.title}
          </h1>
          {course.summary && (
            <p className="mb-4 text-sm text-gray-500">{course.summary}</p>
          )}
          <div className="mb-6 flex flex-wrap items-center gap-6">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-extrabold text-navy">{price}</span>
              {course.oldPrice !== undefined && (
                <span className="mb-0.5 text-lg text-slate-400 line-through">
                  {formatPrice(course.oldPrice)}
                </span>
              )}
              {discount !== null && (
                <span className="mb-1 rounded bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {discount}% OFF
                </span>
              )}
            </div>
            <Stars reviews={course.reviews} rating={course.rating} suffix=" reviews" />
          </div>

          <dl className="mb-8 grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl border border-gray-200 bg-white p-5 text-sm sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt className="mb-1 font-medium text-gray-500">
                  {detail.label}
                </dt>
                <dd className="font-semibold text-navy">{detail.value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mb-3 text-xl font-bold text-navy">Overview</h2>
          {lead && <p className="mb-4 text-sm leading-relaxed text-gray-600">{lead}</p>}
          {description ? (
            <RichText doc={description} />
          ) : (
            !lead && (
              <p className="text-sm leading-relaxed text-gray-600">
                {course.summary ??
                  "Full course details will appear here once the course is published."}
              </p>
            )
          )}

          <h2 className="mt-10 mb-3 text-xl font-bold text-navy">Curriculum</h2>
          {course.modules.length > 0 ? (
            <div className="space-y-4">
              {course.modules.map((module, index) => (
                <section
                  key={module.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <h3 className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-navy">
                    Module {index + 1} · {module.title}
                  </h3>
                  {module.description && (
                    <p className="px-5 pt-3 text-xs text-gray-500">{module.description}</p>
                  )}
                  <ul className="divide-y divide-gray-100">
                    {module.lessons.map((lesson) => {
                      const Icon = lessonIcons[lesson.type];
                      const length = formatLessonDuration(lesson.durationSeconds);
                      const open = enrolled || lesson.isFreePreview;
                      const done = completed.has(lesson.id);
                      const row = (
                        <>
                          {done ? (
                            <Check className="size-4 shrink-0 text-green-600" aria-label="Completed" />
                          ) : open ? (
                            <Icon className="size-4 shrink-0 text-blue-600" aria-hidden />
                          ) : (
                            <Lock className="size-4 shrink-0 text-gray-300" aria-hidden />
                          )}
                          <span className={cn("min-w-0 flex-1", open ? "text-gray-700" : "text-gray-500")}>{lesson.title}</span>
                          {lesson.isFreePreview && !enrolled && (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                              Preview
                            </span>
                          )}
                          {length && <span className="text-xs text-gray-400">{length}</span>}
                        </>
                      );
                      return (
                        <li key={lesson.id}>
                          {open ? (
                            <Link
                              href={`/learn/${course.slug}/${lesson.slug}`}
                              className="flex items-center gap-3 px-5 py-3 text-sm transition outline-none hover:bg-blue-50 focus-visible:bg-blue-50"
                            >
                              {row}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 px-5 py-3 text-sm">{row}</div>
                          )}
                        </li>
                      );
                    })}
                    {module.lessons.length === 0 && (
                      <li className="px-5 py-3 text-xs text-gray-400">No lessons yet.</li>
                    )}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              The curriculum will appear here soon.
            </p>
          )}

          {course.instructor && (
            <>
              <h2 className="mt-10 mb-3 text-xl font-bold text-navy">Your instructor</h2>
              <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5">
                <UserAvatar
                  name={course.instructor.name}
                  image={course.instructor.image}
                  className="size-14 text-lg"
                />
                <div>
                  <p className="font-bold text-navy">{course.instructor.name}</p>
                  {course.instructor.bio && (
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      {course.instructor.bio}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <div id="reviews" className="mt-10 mb-3 flex flex-wrap items-baseline justify-between gap-2 scroll-mt-24">
            <h2 className="text-xl font-bold text-navy">Reviews</h2>
            {course.reviews > 0 && course.rating !== null && (
              <p className="text-sm text-gray-600">
                <span className="text-lg font-extrabold text-navy">{course.rating.toFixed(1)}</span> out of 5 ·{" "}
                {course.reviews} {course.reviews === 1 ? "review" : "reviews"}
              </p>
            )}
          </div>
          {enrolled && (
            <div className="mb-4">
              <CourseReviewForm slug={course.slug} review={myReview} />
            </div>
          )}
          {reviews.length > 0 ? (
            <ul className="space-y-4">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={review.name} image={review.image} className="size-10" />
                    <div>
                      <p className="text-sm font-bold text-navy">{review.name}</p>
                      <p className="text-xs text-amber-500" aria-label={`Rated ${review.rating} out of 5`}>
                        {"★".repeat(review.rating)}
                        <span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
                        <span className="ml-2 text-gray-400">
                          {dateFormatter.format(review.date)}
                        </span>
                      </p>
                    </div>
                  </div>
                  {review.title && <p className="mt-3 text-sm font-semibold text-navy">{review.title}</p>}
                  {review.body && <p className="mt-1 text-sm leading-relaxed text-gray-600">{review.body}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              No reviews yet. Learners can review this course once they have enrolled.
            </p>
          )}

          {related.length > 0 && (
            <>
              <h2 className="mt-10 mb-3 text-xl font-bold text-navy">Related courses</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {related.slice(0, 2).map((item) => (
                  <CourseCard key={item.slug} course={item} />
                ))}
              </div>
            </>
          )}
        </div>

        <aside>
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
              <CourseImage
                course={course}
                srcWidth={600}
                width={600}
                height={320}
                preload
                className="h-40 w-full rounded-lg object-cover"
              />
            </div>
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
              {enrol && enrolMessages[enrol] && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {enrolMessages[enrol]}
                </p>
              )}
              {enrolled && enrolment ? (
                <>
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs font-semibold text-gray-600">
                      <span>{enrolment.status === "COMPLETED" ? "Completed" : "Your progress"}</span>
                      <span>{enrolment.progressPercent}%</span>
                    </div>
                    <ProgressBar value={enrolment.progressPercent} />
                  </div>
                  <Link
                    href={`/learn/${course.slug}`}
                    className="block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    {enrolment.status === "COMPLETED"
                      ? "Review course"
                      : enrolment.progressPercent === 0 && enrolment.lastLessonId === null
                        ? "Start course"
                        : "Continue learning"}
                  </Link>
                </>
              ) : enrolment?.status === "CANCELLED" && free ? (
                <p className="text-sm text-gray-600">Your enrolment in this course was cancelled. Contact support to rejoin.</p>
              ) : free ? (
                <form action={enrolInCourse}>
                  <input type="hidden" name="slug" value={course.slug} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700"
                  >
                    Enrol for free
                  </button>
                  {!user && <p className="mt-2 text-center text-xs text-gray-500">You will be asked to log in first.</p>}
                </form>
              ) : (
                <>
                  <form action={addToCart}>
                    <input type="hidden" name="slug" value={course.slug} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      Add to Cart
                    </button>
                  </form>
                  <form action={buyNow}>
                    <input type="hidden" name="slug" value={course.slug} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700"
                    >
                      Buy Now
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
