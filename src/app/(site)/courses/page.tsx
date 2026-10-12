import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CourseListItem } from "@/components/site/course-card";
import { cn } from "@/lib/utils";
import { getCourseCategories, getCourses } from "@/services/course";

export const metadata: Metadata = {
  title: "All Courses",
};

type CoursesPageProps = {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

// Link to /courses with the filters that are set.
function listHref(q: string, category: string | undefined, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/courses?${query}` : "/courses";
}

const chipClassName = "rounded-full border px-3 py-1 text-xs font-semibold transition";

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const { q = "", category, page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Math.trunc(Number(pageParam)) || 1);
  const [{ courses, total, page, pageSize }, categories] = await Promise.all([
    getCourses({ search: q, category, page: requestedPage }),
    getCourseCategories(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-extrabold text-navy">
        {total} Online courses (E-learning training)
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        It&apos;s easy to find the best course to fit your needs.
      </p>
      <form className="mb-4 flex gap-3 rounded-lg border border-gray-200 bg-white p-2">
        <label className="flex flex-1 items-center px-2">
          <Search className="mr-2 size-4 text-gray-400" />
          <span className="sr-only">Search courses</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search courses..."
            className="w-full py-2 text-sm text-gray-700 outline-none"
          />
        </label>
        {category && <input type="hidden" name="category" value={category} />}
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {categories.length > 0 && (
        <nav aria-label="Categories" className="mb-6 flex flex-wrap gap-2">
          <Link
            href={listHref(q, undefined)}
            className={cn(
              chipClassName,
              !category
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-blue-300",
            )}
          >
            All
          </Link>
          {categories.map((item) => (
            <Link
              key={item.slug}
              href={listHref(q, item.slug)}
              className={cn(
                chipClassName,
                category === item.slug
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-blue-300",
              )}
            >
              {item.name} ({item.courseCount})
            </Link>
          ))}
        </nav>
      )}

      {courses.length > 0 ? (
        <div className="space-y-5">
          {courses.map((course) => (
            <CourseListItem key={course.slug} course={course} />
          ))}
          {pageCount > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between pt-2 text-sm">
              {page > 1 ? (
                <Link
                  href={listHref(q, category, page - 1)}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-gray-500">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link
                  href={listHref(q, category, page + 1)}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-gray-800">
            {q ? `No courses match “${q}”` : "No courses here yet"}
          </p>
          <Link
            href="/courses"
            className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline"
          >
            View all courses
          </Link>
        </div>
      )}
    </div>
  );
}
