import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CourseListItem } from "@/components/site/course-card";
import { getCourses } from "@/services/course";

export const metadata: Metadata = {
  title: "All Courses",
};

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const courses = await getCourses(q);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-extrabold text-navy">
        {courses.length} Online courses (E-learning training)
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        It&apos;s easy to find the best course to fit your needs.
      </p>
      <form className="mb-6 flex gap-3 rounded-lg border border-gray-200 bg-white p-2">
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
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {courses.length > 0 ? (
        <div className="space-y-5">
          {courses.map((course) => (
            <CourseListItem key={course.slug} course={course} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-gray-800">
            No courses match “{q}”
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
