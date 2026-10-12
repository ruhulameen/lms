import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { lessonTypeIcons } from "@/components/admin/lesson-type-icon";
import { RichText } from "@/components/site/rich-text";
import { UserAvatar } from "@/components/site/user-avatar";
import { courseLevelLabels, discountPercent, formatCourseDuration, formatLessonDuration, secondsToMinutes } from "@/lib/course";
import { formatPrice } from "@/lib/format";
import { isEmptyDocument, sanitizeDocument, type RichTextDocument } from "@/lib/rich-text";
import { parseRouteId } from "@/lib/route-id";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseForEdit, getCoursePreviewExtras } from "@/services/course-admin";
import { getCourseIntroVideoUrl } from "@/services/lesson-access";

// The public course page for any course, whatever its status. Read-only: the
// buy buttons are not wired, and hidden lessons are marked so they are not missed.
export async function CoursePreviewView({ base, params }: { base: string; params: Promise<{ id: string }> }) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const { user } = await assertCourseAccess(id, "course.view");
  const [course, extras] = await Promise.all([getCourseForEdit(id), getCoursePreviewExtras(id)]);
  if (!course || !extras) notFound();
  const intro = course.introVideoKey ? await getCourseIntroVideoUrl(user, id) : null;

  let description: RichTextDocument | null = null;
  try {
    description = course.description ? sanitizeDocument(course.description) : null;
  } catch {
    description = null;
  }
  const hasDescription = description !== null && !isEmptyDocument(description);
  const lessons = course.modules.flatMap((m) => m.lessons);
  const visibleLessons = lessons.filter((l) => l.published);
  const summedMinutes = secondsToMinutes(visibleLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0));
  const duration = formatCourseDuration(course.durationMinutes ?? summedMinutes);
  const free = course.price <= 0;
  const discount = !free ? discountPercent(course.price, course.compareAtPrice) : null;
  const details = [
    { label: "Price", value: free ? "Free" : formatPrice(course.price) },
    { label: "Study method", value: "Online, self-paced" },
    { label: "Duration", value: duration ?? "Self-paced" },
    { label: "Level", value: courseLevelLabels[course.level] },
    { label: "Language", value: course.language },
    { label: "Category", value: extras.category ?? "None" },
    { label: "Lessons", value: String(visibleLessons.length) },
  ];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-amber-100 px-4 py-2.5 text-sm text-amber-950">
        <span className="flex items-center gap-2">
          <strong>Preview — not published.</strong>
          <ContentStatusBadge status={course.status} />
        </span>
        <span className="flex gap-4">
          <Link href={`${base}/${id}/edit`} className="font-medium underline">
            Back to the editor
          </Link>
          <Link href={`${base}/${id}/curriculum`} className="font-medium underline">
            Curriculum
          </Link>
        </span>
      </div>
      <div className="bg-slate-50 text-gray-800">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="lg:col-span-2">
            <h1 className="mb-2 text-2xl leading-tight font-extrabold text-navy">{course.title}</h1>
            {course.subtitle && <p className="mb-2 text-base text-gray-600">{course.subtitle}</p>}
            {course.badge && <span className="mb-3 inline-block rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">{course.badge}</span>}
            <div className="mb-6 flex flex-wrap items-end gap-3">
              <span className="text-3xl font-extrabold text-navy">{free ? "Free" : formatPrice(course.price)}</span>
              {course.compareAtPrice !== null && !free && (
                <span className="mb-0.5 text-lg text-slate-400 line-through">{formatPrice(course.compareAtPrice)}</span>
              )}
              {discount !== null && <span className="mb-1 rounded bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{discount}% OFF</span>}
            </div>

            {intro && intro.ok && (
              <video controls preload="metadata" src={intro.url} className="mb-6 aspect-video w-full rounded-xl bg-black" aria-label="Intro video" />
            )}

            <dl className="mb-8 grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl border border-gray-200 bg-white p-5 text-sm sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label}>
                  <dt className="mb-1 font-medium text-gray-500">{detail.label}</dt>
                  <dd className="font-semibold text-navy">{detail.value}</dd>
                </div>
              ))}
            </dl>

            <h2 className="mb-3 text-xl font-bold text-navy">Overview</h2>
            {course.shortDescription && <p className="mb-4 text-sm leading-relaxed text-gray-600">{course.shortDescription}</p>}
            {hasDescription ? (
              <RichText doc={description} />
            ) : (
              !course.shortDescription && <p className="text-sm text-gray-500">No description yet.</p>
            )}

            <h2 className="mt-10 mb-3 text-xl font-bold text-navy">Curriculum</h2>
            {course.modules.length > 0 ? (
              <div className="space-y-4">
                {course.modules.map((module, index) => (
                  <section key={module.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <h3 className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold text-navy">
                      Module {index + 1} · {module.title}
                    </h3>
                    {module.description && <p className="px-5 pt-3 text-xs text-gray-500">{module.description}</p>}
                    <ul className="divide-y divide-gray-100">
                      {module.lessons.map((lesson) => {
                        const Icon = lessonTypeIcons[lesson.type];
                        const length = formatLessonDuration(lesson.durationSeconds);
                        return (
                          <li key={lesson.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                            <Icon className="size-4 shrink-0 text-blue-600" aria-hidden />
                            <Link href={`${base}/${id}/preview/lessons/${lesson.id}`} className="min-w-0 flex-1 text-gray-700 hover:underline">
                              {lesson.title}
                            </Link>
                            {!lesson.published && <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">Hidden from learners</span>}
                            {lesson.isFreePreview && <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">Preview</span>}
                            {length && <span className="text-xs text-gray-400">{length}</span>}
                          </li>
                        );
                      })}
                      {module.lessons.length === 0 && <li className="px-5 py-3 text-xs text-gray-400">No lessons yet.</li>}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">The curriculum will appear here soon.</p>
            )}

            {extras.instructor && (
              <>
                <h2 className="mt-10 mb-3 text-xl font-bold text-navy">Your instructor</h2>
                <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5">
                  <UserAvatar name={extras.instructor.name} image={extras.instructor.image} className="size-14 text-lg" />
                  <div>
                    <p className="font-bold text-navy">{extras.instructor.name}</p>
                    {extras.instructor.bio && <p className="mt-1 text-sm leading-relaxed text-gray-600">{extras.instructor.bio}</p>}
                  </div>
                </div>
              </>
            )}
          </div>

          <aside>
            <div className="space-y-6 lg:sticky lg:top-6">
              <div className="relative h-40 overflow-hidden rounded-xl border border-gray-200 bg-linear-to-br from-blue-100 to-sky-200">
                {extras.imageSrc && <Image src={extras.imageSrc} alt="" fill sizes="400px" className="object-cover" />}
              </div>
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
                <span className="block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-bold text-white opacity-60">Add to Cart</span>
                <span className="block w-full rounded-lg bg-green-600 py-3 text-center text-sm font-bold text-white opacity-60">{free ? "Enrol Free" : "Buy Now"}</span>
                <p className="text-center text-xs text-gray-500">Buttons are inactive in the preview.</p>
              </div>
              {extras.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                  {extras.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
