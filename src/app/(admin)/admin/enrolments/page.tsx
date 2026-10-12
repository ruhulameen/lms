import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { DataTableToolbar, FilterSelect } from "@/components/admin/data-table";
import { EnrolmentTable } from "@/components/admin/enrolment-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { manageableCoursesWhere } from "@/services/course-access";
import { ENROLMENT_SORT_KEYS, listCourseOptions, listEnrolments, type EnrolmentStatusValue } from "@/services/learners";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Enrolments" };

const BASE = "/admin";
const STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;

export default async function EnrolmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission("enrolment.view");
  const params = await searchParams;
  const scope = manageableCoursesWhere(user);

  const status = STATUSES.find((s) => s === firstParam(params.status)) as EnrolmentStatusValue | undefined;
  const courseId = intParam(params.course, 0) || undefined;
  const sort = sortParams(params, ENROLMENT_SORT_KEYS, { sort: "activity", order: "desc" });
  const [list, courses] = await Promise.all([
    listEnrolments({ search: firstParam(params.q), courseId, status, page: intParam(params.page), ...sort }, scope),
    listCourseOptions(scope),
  ]);
  const canManage = can(user, "enrolment.manage");

  return (
    <>
      <PageHeader
        title="Enrolments"
        description="Who is taking which course, and how far they have got."
        actions={
          canManage && (
            <Button render={<Link href={`${BASE}/enrolments/new`} />}>
              <UserPlus aria-hidden /> Assign a course
            </Button>
          )
        }
      />
      <EnrolmentTable
        caption="Enrolments"
        rows={list.rows}
        basePath={BASE}
        tablePath={`${BASE}/enrolments`}
        searchParams={params}
        sort={sort}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        canManage={canManage}
        toolbar={
          <DataTableToolbar basePath={`${BASE}/enrolments`} searchParams={params} searchPlaceholder="Search learner or course">
            <FilterSelect name="course" label="All courses" searchParams={params} options={courses.map((c) => ({ value: String(c.id), label: c.title }))} />
            <FilterSelect
              name="status"
              label="All statuses"
              searchParams={params}
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
