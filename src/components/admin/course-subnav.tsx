import Link from "next/link";
import { cn } from "@/lib/utils";
import { can, getCurrentUser } from "@/services/user";

type CourseSubnavProps = {
  courseId: number;
  basePath: string;
  active: "overview" | "edit" | "curriculum" | "preview" | "learners";
};

// Links between the screens of one course. Overview is the admin panel's only.
// Server component: `active` marks
// the current one; Learners shows for people who may view enrolments, and in
// the instructor panel (the learners page then checks course ownership).
export async function CourseSubnav({ courseId, basePath, active }: CourseSubnavProps) {
  const user = await getCurrentUser();
  const items = [
    ...(basePath === "/admin/courses" ? [{ key: "overview", label: "Overview", href: `${basePath}/${courseId}` } as const] : []),
    { key: "edit", label: "Details", href: `${basePath}/${courseId}/edit` },
    { key: "curriculum", label: "Curriculum", href: `${basePath}/${courseId}/curriculum` },
    { key: "preview", label: "Preview", href: `${basePath}/${courseId}/preview` },
    ...((basePath.startsWith("/instructor/") || (user && can(user, "enrolment.view"))) ? [{ key: "learners", label: "Learners", href: `${basePath}/${courseId}/learners` } as const] : []),
  ];
  return (
    <nav aria-label="Course sections" className="mb-6 flex gap-1 border-b">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            item.key === active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
