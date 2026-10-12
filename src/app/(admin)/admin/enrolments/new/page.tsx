import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { AssignEnrolmentForm } from "@/components/admin/assign-enrolment-form";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { firstParam, intParam, type SearchParams } from "@/lib/table-params";
import { manageableCoursesWhere } from "@/services/course-access";
import { getUserBrief, listAssignableCourses, searchUsers } from "@/services/learners";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Assign a course" };

const BASE = "/admin";

// Step 1: find the learner (a GET search). Step 2: choose the course.
export default async function AssignEnrolmentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("enrolment.manage");
  const params = await searchParams;
  const q = firstParam(params.q) ?? "";
  const userId = intParam(params.user, 0);
  const scope = manageableCoursesWhere(viewer);

  const learner = userId ? await getUserBrief(userId) : null;
  if (userId && !learner) notFound();
  const [matches, courses] = await Promise.all([
    learner ? [] : searchUsers(q),
    learner ? listAssignableCourses(learner.id, scope) : [],
  ]);

  return (
    <>
      <PageHeader
        title="Assign a course"
        description="Give a learner access to a published course, for example one they have paid for."
        actions={
          <Button variant="outline" render={<Link href={`${BASE}/enrolments`} />}>
            <ChevronLeft aria-hidden /> Enrolments
          </Button>
        }
      />
      <div className="grid max-w-2xl gap-6 rounded-xl border bg-white p-4 sm:p-6">
        {learner ? (
          <>
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Learner</p>
              <p className="font-medium">{learner.name}</p>
              <p className="text-sm text-slate-500">{learner.email}</p>
              <Link href={`${BASE}/enrolments/new`} className="text-sm text-blue-700 hover:underline">
                Choose someone else
              </Link>
            </div>
            {learner.status !== "ACTIVE" ? (
              <p role="alert" className="text-sm text-destructive">
                This account is {learner.status.toLowerCase()}. Reactivate it before assigning a course.
              </p>
            ) : (
              <AssignEnrolmentForm userId={learner.id} courses={courses.map((c) => ({ id: c.id, title: c.title, price: Number(c.price) }))} defaultCourseId={intParam(params.course, 0) || undefined} doneHref={`${BASE}/enrolments`} />
            )}
          </>
        ) : (
          <>
            <form method="get" action={`${BASE}/enrolments/new`} role="search" className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input type="search" name="q" defaultValue={q} placeholder="Search learner name or email" aria-label="Search learner name or email" className="pl-8" autoFocus />
              </div>
              {intParam(params.course, 0) > 0 && <input type="hidden" name="course" value={firstParam(params.course)} />}
              <Button type="submit">Search</Button>
            </form>
            {q && matches.length === 0 && <p className="text-sm text-slate-500">No active users match &ldquo;{q}&rdquo;.</p>}
            {matches.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{m.name}</span>
                      <span className="block truncate text-sm text-slate-500">{m.email}</span>
                    </span>
                    <Button variant="outline" size="sm" render={<Link href={`${BASE}/enrolments/new?user=${m.id}${intParam(params.course, 0) > 0 ? `&course=${intParam(params.course, 0)}` : ""}`} />}>
                      Choose
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
