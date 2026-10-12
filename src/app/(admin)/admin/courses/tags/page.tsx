import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCourseTag } from "@/actions/course-taxonomy";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { TaxonomyFormDialog } from "@/components/admin/taxonomy-form-dialog";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { listCourseTags, COURSE_TAXONOMY_SORT_KEYS } from "@/services/course-taxonomy";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Course tags" };

export default async function BlogTagsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("course.view");
  const params = await searchParams;
  const canManage = can(viewer, "course-taxonomy.manage");
  const sort = sortParams(params, COURSE_TAXONOMY_SORT_KEYS, { sort: "name", order: "asc" });
  const { rows, total, page, pageSize } = await listCourseTags({
    search: firstParam(params.q),
    page: intParam(params.page),
    ...sort,
  });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: "name", header: "Name", sortable: true, cell: (t) => <span className="font-medium">{t.name}</span> },
    { key: "slug", header: "Slug", sortable: true, cell: (t) => t.slug },
    { key: "courses", header: "Courses", sortable: true, cell: (t) => t._count.courses },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (t: (typeof rows)[number]) => (
              <div className="flex gap-1.5">
                <TaxonomyFormDialog
                  kind="tag" domain="course"
                  item={t}
                  trigger={<><Pencil aria-hidden /> Rename</>}
                  triggerLabel={`Rename tag ${t.name}`}
                  triggerVariant="ghost"
                />
                <ConfirmDialog
                  action={deleteCourseTag}
                  fields={{ id: String(t.id) }}
                  title={`Delete "${t.name}"?`}
                  description={
                    t._count.courses > 0
                      ? `The tag is removed from ${t._count.courses} course${t._count.courses === 1 ? "" : "s"}. The courses themselves are not changed.`
                      : "No courses use this tag."
                  }
                  trigger={<><Trash2 aria-hidden /> Delete</>}
                  triggerVariant="ghost"
                  triggerLabel={`Delete tag ${t.name}`}
                  confirmLabel="Delete tag"
                  destructive
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Course tags"
        description="Free-form labels. Editors can also create tags while editing a course."
        actions={canManage && <TaxonomyFormDialog kind="tag" domain="course" trigger={<><Plus aria-hidden /> New tag</>} triggerVariant="default" />}
      />
      <DataTable
        caption="Course tags"
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        basePath="/admin/courses/tags"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No tags found"
        emptyDescription={canManage ? "Create a tag, or add one while editing a course." : "Nothing matches that search."}
        toolbar={<DataTableToolbar basePath="/admin/courses/tags" searchParams={params} searchPlaceholder="Search name or slug" />}
      />
    </>
  );
}
