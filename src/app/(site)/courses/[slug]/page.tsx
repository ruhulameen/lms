import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCart, buyNow } from "@/actions/cart";
import { Stars } from "@/components/site/stars";
import { formatPrice, unsplash } from "@/lib/format";
import { getCourseBySlug } from "@/services/course";

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  return { title: course?.title ?? "Course not found" };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const price = course.price === 0 ? "Free" : formatPrice(course.price);
  const discount =
    course.oldPrice && course.price > 0
      ? Math.round((1 - course.price / course.oldPrice) * 100)
      : null;

  const details = [
    { label: "Price", value: price },
    { label: "Study method", value: "Online, self-paced" },
    { label: "Duration", value: course.duration ?? "Self-paced" },
    { label: "Category", value: course.category },
  ];

  return (
    <>
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
            <Stars reviews={course.reviews} suffix=" reviews" />
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
          <p className="text-sm leading-relaxed text-gray-600">
            {course.summary ??
              "Full course details will appear here once the course is published."}
          </p>
        </div>

        <aside>
          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
              <Image
                src={unsplash(course.image, 600)}
                alt=""
                width={600}
                height={320}
                preload
                className="h-40 w-full rounded-lg object-cover"
              />
            </div>
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
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
                  {course.price === 0 ? "Enrol Free" : "Buy Now"}
                </button>
              </form>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
