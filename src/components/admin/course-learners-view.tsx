import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { DataTableToolbar, FilterSelect } from "@/components/admin/data-table";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { CourseSubnav } from "@/components/admin/course-subnav";
import { EnrolmentTable } from "@/components/admin/enrolment-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { parseRouteId } from "@/lib/route-id";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { assertCourseAccess } from "@/services/course-access";
import { getCourseHeading } from "@/services/course-admin";
import { ENROLMENT_SORT_KEYS, listEnrolments, type EnrolmentStatusValue } from "@/services/learners";
import { can } from "@/services/user";

const ADMIN_ROOT = "/admin";
const INSTRUCTOR_BASE = "/instructor/courses";
const STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;

// The learners of one course and how far each has got.
export async function CourseLearnersView({
  base,
  params,
  searchParams,
}: {
  base: string;
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  // Staff see every course's learners with enrolment.view. An instructor has no
  // such permission: they read the learners of a course they own, read-only.
  const instructorView = base === INSTRUCTOR_BASE;
  const { user } = await assertCourseAccess(id, instructorView ? "course.view" : "enrolment.view");
  const query = await searchParams;
  const course = await getCourseHeading(id);
  if (!course) notFound();

  const status = STATUSES.find((s) => s === firstParam(query.status)) as EnrolmentStatusValue | undefined;
  const sort = sortParams(query, ENROLMENT_SORT_KEYS, { sort: "activity", order: "desc" });
  const list = await listEnrolments({ courseId: id, search: firstParam(query.q), status, page: intParam(query.page), ...sort });
  const canManage = !instructorView && can(user, "enrolment.manage");
  const path = `${base}/${id}/learners`;

  return (
    <>
      <PageHeader
        title={course.title}
        description={`${list.total} ${list.total === 1 ? "learner" : "learners"}`}
        actions={
          <>
            <ContentStatusBadge status={course.status} className="self-center" />
            {canManage && (
              <Button render={<Link href={`${ADMIN_ROOT}/enrolments/new?course=${id}`} />}>
                <UserPlus aria-hidden /> Assign a learner
              </Button>
            )}
          </>
        }
      />
      <CourseSubnav courseId={id} basePath={base} active="learners" />
      <EnrolmentTable
        caption={`Learners of ${course.title}`}
        rows={list.rows}
        basePath={ADMIN_ROOT}
        linkLearners={!instructorView}
        tablePath={path}
        searchParams={query}
        sort={sort}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        hide="course"
        canManage={canManage}
        emptyTitle="No learners yet"
        emptyDescription="Learners appear here when they join or are assigned this course."
        toolbar={
          <DataTableToolbar basePath={path} searchParams={query} searchPlaceholder="Search name or email">
            <FilterSelect
              name="status"
              label="All statuses"
              searchParams={query}
              options={[
                { value: "ACTIVE", label: "In progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </DataTableToolbar>
        }
      />
    </>
  );
}
