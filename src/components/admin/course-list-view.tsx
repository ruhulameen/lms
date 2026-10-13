import Image from "next/image";
import Link from "next/link";
import { Archive, Copy, ExternalLink, Eye, ListTree, Pencil, Plus, Star, Trash2, Undo2, Upload } from "lucide-react";
import { deleteCourse, duplicateCourse, setCourseStatus } from "@/actions/course";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/activity-details";
import { contentStatuses, contentStatusMeta, isPublic } from "@/lib/content-status";
import { formatPrice } from "@/lib/format";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { canManageCourse, manageableCoursesWhere } from "@/services/course-access";
import { COURSE_SORT_KEYS, listCourseCategoryOptions, listCourses, listInstructorOptions } from "@/services/course-admin";
import { can, requirePermission } from "@/services/user";

const ADMIN_BASE = "/admin/courses";

const idParam = (value: string | string[] | undefined) => {
  const raw = firstParam(value);
  return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
};

export async function CourseListView({ base, searchParams }: { base: string; searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("course.view");
  const params = await searchParams;

  const status = contentStatuses.find((s) => s === firstParam(params.status));
  const sort = sortParams(params, COURSE_SORT_KEYS, { sort: "updated", order: "desc" });
  const [{ rows, total, page, pageSize }, categories, instructors] = await Promise.all([
    listCourses({
      search: firstParam(params.q),
      status,
      categoryId: idParam(params.category),
      instructorId: idParam(params.instructor),
      scope: manageableCoursesWhere(viewer),
      page: intParam(params.page),
      ...sort,
    }),
    listCourseCategoryOptions(),
    listInstructorOptions(),
  ]);

  const canPublish = can(viewer, "course.publish");
  const canCreate = can(viewer, "course.create");
  const canDelete = can(viewer, "course.delete");
  const canEditPermission = can(viewer, "course.edit");

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "thumbnail",
      header: "Image",
      cell: (c) => (
        <span className="relative block h-9 w-14 overflow-hidden rounded bg-linear-to-br from-blue-100 to-sky-200">
          {c.imageSrc && <Image src={c.imageSrc} alt="" fill sizes="56px" className="object-cover" />}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      sortable: true,
      className: "max-w-xs whitespace-normal",
      cell: (c) => (
        <Link href={`${base}/${c.id}/edit`} className="font-medium text-blue-700 hover:underline">
          {c.title}
          {c.featured && <Star className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-500" aria-label="Featured" />}
        </Link>
      ),
    },
    { key: "category", header: "Category", sortable: true, cell: (c) => c.category?.name ?? <span className="text-slate-400">None</span> },
    { key: "instructor", header: "Instructor", sortable: true, cell: (c) => c.instructor?.name ?? <span className="text-slate-400">None</span> },
    { key: "price", header: "Price", sortable: true, cell: (c) => (c.price > 0 ? formatPrice(c.price) : "Free") },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (c) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <ContentStatusBadge status={c.status} />
          {c.status === "SCHEDULED" && c.publishAt && <span className="text-xs text-slate-500">{formatDateTime(c.publishAt)}</span>}
        </span>
      ),
    },
    { key: "lessons", header: "Lessons", cell: (c) => c._count.lessons },
    { key: "learners", header: "Learners", cell: (c) => c._count.enrolments },
    { key: "updated", header: "Updated", sortable: true, cell: (c) => formatDate(c.updatedAt) },
    {
      key: "actions",
      header: "Actions",
      cell: (c) => {
        // Row actions follow ownership: someone without publish rights only manages their own courses.
        const manage = canManageCourse(viewer, c);
        return (
          <div className="flex flex-wrap gap-1.5">
            {manage && canEditPermission && (
              <Button variant="ghost" size="sm" render={<Link href={`${base}/${c.id}/edit`} />} aria-label={`Edit ${c.title}`}>
                <Pencil aria-hidden /> Edit
              </Button>
            )}
            {manage && (
              <Button variant="ghost" size="sm" render={<Link href={`${base}/${c.id}/curriculum`} />} aria-label={`Curriculum of ${c.title}`}>
                <ListTree aria-hidden /> Curriculum
              </Button>
            )}
            {manage && (
              <Button variant="ghost" size="sm" render={<Link href={`${base}/${c.id}/preview`} />} aria-label={`Preview ${c.title}`}>
                <Eye aria-hidden /> Preview
              </Button>
            )}
            {isPublic(c.status, c.publishAt) && (
              <Button variant="ghost" size="sm" render={<Link href={`/courses/${c.slug}`} target="_blank" />} aria-label={`View ${c.title} on the site`}>
                <ExternalLink aria-hidden /> View
              </Button>
            )}
            {manage && canPublish && c.status !== "PUBLISHED" && c.status !== "ARCHIVED" && (
              <ConfirmDialog
                action={setCourseStatus}
                fields={{ id: String(c.id), status: "PUBLISHED" }}
                title="Publish this course?"
                description={`"${c.title}" goes live in the catalogue straight away.`}
                trigger={<><Upload aria-hidden /> Publish</>}
                triggerVariant="ghost"
                triggerLabel={`Publish ${c.title}`}
                confirmLabel="Publish"
              />
            )}
            {manage && canPublish && (c.status === "PUBLISHED" || c.status === "SCHEDULED") && (
              <ConfirmDialog
                action={setCourseStatus}
                fields={{ id: String(c.id), status: "DRAFT" }}
                title="Unpublish this course?"
                description={`"${c.title}" is taken off the site and saved as a draft. Enrolled learners keep their access.`}
                trigger={<><Undo2 aria-hidden /> Unpublish</>}
                triggerVariant="ghost"
                triggerLabel={`Unpublish ${c.title}`}
                confirmLabel="Unpublish"
              />
            )}
            {manage && canPublish && c.status === "ARCHIVED" && (
              <ConfirmDialog
                action={setCourseStatus}
                fields={{ id: String(c.id), status: "DRAFT" }}
                title="Restore this course?"
                description={`"${c.title}" becomes a draft again.`}
                trigger={<><Undo2 aria-hidden /> Restore</>}
                triggerVariant="ghost"
                triggerLabel={`Restore ${c.title}`}
                confirmLabel="Restore"
              />
            )}
            {manage && canPublish && c.status !== "ARCHIVED" && (
              <ConfirmDialog
                action={setCourseStatus}
                fields={{ id: String(c.id), status: "ARCHIVED" }}
                title="Archive this course?"
                description={`"${c.title}" is taken off the site. Learners who are enrolled keep their access and records.`}
                trigger={<><Archive aria-hidden /> Archive</>}
                triggerVariant="ghost"
                triggerLabel={`Archive ${c.title}`}
                confirmLabel="Archive"
              />
            )}
            {manage && canCreate && (
              <ConfirmDialog
                action={duplicateCourse}
                fields={{ id: String(c.id), basePath: base }}
                title="Duplicate this course?"
                description="A draft copy is created with the same modules, lessons and quiz questions. Videos, documents and resources are not copied: add them to the copy."
                trigger={<><Copy aria-hidden /> Duplicate</>}
                triggerVariant="ghost"
                triggerLabel={`Duplicate ${c.title}`}
                confirmLabel="Duplicate"
              />
            )}
            {manage && canDelete && (
              <ConfirmDialog
                action={deleteCourse}
                fields={{ id: String(c.id), basePath: base }}
                title="Delete this course?"
                description={
                  c._count.enrolments > 0
                    ? `"${c.title}" has ${c._count.enrolments} enrolment${c._count.enrolments === 1 ? "" : "s"} and cannot be deleted. Archive it instead.`
                    : `"${c.title}", its modules, lessons, files, reviews and SEO settings are deleted for good.`
                }
                trigger={<><Trash2 aria-hidden /> Delete</>}
                triggerVariant="ghost"
                triggerLabel={`Delete ${c.title}`}
                confirmLabel="Delete course"
                destructive
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Courses"
        description={canPublish ? "Every course: build the curriculum, review, schedule and publish." : "Your courses."}
        actions={
          <>
            {base === ADMIN_BASE && (
              <Button variant="outline" render={<Link href={`${base}/categories`} />}>
                Categories and tags
              </Button>
            )}
            {canCreate && (
              <Button render={<Link href={`${base}/new`} />}>
                <Plus aria-hidden /> New course
              </Button>
            )}
          </>
        }
      />
      {firstParam(params.deleted) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Course deleted.
        </p>
      )}
      <DataTable
        caption="Courses"
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        basePath={base}
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No courses found"
        emptyDescription={canCreate ? "Try different filters, or create the first course." : "Try a different search or clear the filters."}
        toolbar={
          <DataTableToolbar basePath={base} searchParams={params} searchPlaceholder="Search title or slug">
            <FilterSelect
              name="status"
              label="All statuses"
              searchParams={params}
              options={contentStatuses.map((s) => ({ value: s, label: contentStatusMeta[s].label }))}
            />
            <FilterSelect name="category" label="All categories" searchParams={params} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
            {canPublish && (
              <FilterSelect name="instructor" label="All instructors" searchParams={params} options={instructors.map((i) => ({ value: String(i.id), label: i.name }))} />
            )}
          </DataTableToolbar>
        }
      />
    </>
  );
}
