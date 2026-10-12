import Image from "next/image";
import Link from "next/link";
import { Clock, Users } from "lucide-react";
import { Stars } from "@/components/site/stars";
import { categoryStyle } from "@/lib/category";
import { formatCount, formatPrice, unsplash } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Course } from "@/services/course";

const cardClassName =
  "flex flex-col overflow-hidden rounded-xl bg-white transition duration-300 hover:-translate-y-0.5";
const buttonClassName =
  "mt-4 block w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white transition";

export function CourseCard({ course }: { course: Course }) {
  return (
    <div
      className={cn(
        cardClassName,
        "shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)]",
      )}
    >
      <div className="relative h-48">
        <Image
          src={unsplash(course.image, 500)}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <span className="absolute top-3 left-3 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">
          CPD Accredited
        </span>
      </div>
      <div className="flex grow flex-col p-5">
        <h3 className="mb-2 grow text-base leading-tight font-bold text-navy">
          {course.title}
        </h3>
        <Stars reviews={course.reviews} suffix=" reviews" />
        <p className="mt-3 text-xl font-extrabold text-navy">
          {formatPrice(course.price)}
        </p>
        <Link
          href={`/courses/${course.slug}`}
          className={cn(buttonClassName, "bg-blue-600 hover:bg-blue-700")}
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

type DealCardProps = {
  course: Course;
  // Corner label, e.g. "-90%" or "FREE".
  label: string;
  tone: "red" | "orange" | "green";
};

const toneClassName = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  green: "bg-linear-to-br from-green-600 to-green-700",
};

export function DealCard({ course, label, tone }: DealCardProps) {
  const free = course.price === 0;

  return (
    <div
      className={cn(
        cardClassName,
        "border border-gray-200 hover:-translate-y-1 hover:shadow-[0_15px_35px_rgba(0,0,0,0.12)]",
      )}
    >
      <div className="relative h-44">
        <Image
          src={unsplash(course.image, 500)}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <span
          className={cn(
            "absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-extrabold text-white shadow-lg",
            toneClassName[tone],
          )}
        >
          {label}
        </span>
      </div>
      <div className="flex grow flex-col p-5">
        <span
          className={cn(
            "mb-2 text-[10px] font-bold tracking-wider uppercase",
            categoryStyle(course.category).text,
          )}
        >
          {course.category}
        </span>
        <h3 className="mb-2 grow text-sm leading-snug font-bold text-navy">
          {course.title}
        </h3>
        <Stars reviews={course.reviews} />
        <div className="mt-3 flex items-end gap-2">
          <span
            className={cn(
              "text-2xl font-extrabold",
              free ? "text-green-600" : "text-navy",
            )}
          >
            {free ? "£0.00" : formatPrice(course.price)}
          </span>
          {course.oldPrice !== undefined && (
            <span className="mb-1 text-sm text-gray-400 line-through">
              {formatPrice(course.oldPrice)}
            </span>
          )}
        </div>
        <Link
          href={`/courses/${course.slug}`}
          className={cn(
            buttonClassName,
            free
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700",
          )}
        >
          View Details
        </Link>
      </div>
    </div>
  );
}

const tags = [
  { label: "Online", className: "bg-blue-100 text-blue-800" },
  { label: "Beginner", className: "bg-purple-100 text-purple-800" },
  { label: "CPD points", className: "bg-slate-100 text-slate-600" },
  { label: "Tutor support", className: "bg-slate-100 text-slate-600" },
];

export function CourseListItem({ course }: { course: Course }) {
  const href = `/courses/${course.slug}`;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md md:flex-row">
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg md:h-32 md:w-48">
        <Image
          src={unsplash(course.image, 400)}
          alt=""
          fill
          sizes="(min-width: 768px) 12rem, 100vw"
          className="object-cover"
        />
        {course.badge && (
          <span className="absolute bottom-2 left-2 rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
            {course.badge}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="mb-1 text-base font-bold text-navy">
            <Link href={href} className="hover:text-blue-600">
              {course.title}
            </Link>
          </h3>
          {course.summary && (
            <p className="mb-2 text-xs text-gray-500">{course.summary}</p>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <Stars reviews={course.reviews} suffix=" reviews" />
            {course.students !== undefined && (
              <span className="flex items-center gap-1">
                <Users className="size-3" /> {formatCount(course.students)}{" "}
                Students
              </span>
            )}
            {course.duration && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {course.duration}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-semibold",
                  tag.className,
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-4 border-t border-gray-100 pt-3">
          <div className="text-right">
            {course.oldPrice !== undefined && (
              <span className="mr-2 text-sm text-gray-400 line-through">
                {formatPrice(course.oldPrice)}
              </span>
            )}
            <span className="text-lg font-extrabold text-navy">
              {formatPrice(course.price)}
            </span>
          </div>
          <Link
            href={href}
            className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SidebarCourse({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex gap-3 rounded-lg border border-gray-100 bg-white p-3 transition hover:border-blue-300 hover:shadow-[0_8px_20px_rgba(37,99,235,0.1)]"
    >
      <Image
        src={unsplash(course.image, 200)}
        alt=""
        width={64}
        height={64}
        className="size-16 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-sm leading-snug font-semibold text-navy transition-colors group-hover:text-blue-600">
          {course.title}
        </p>
        <Stars reviews={course.reviews} />
        <p className="mt-1.5 text-base font-extrabold text-navy">
          {formatPrice(course.price)}
        </p>
      </div>
    </Link>
  );
}
