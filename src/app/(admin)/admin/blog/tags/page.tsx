import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteBlogTag } from "@/actions/blog-taxonomy";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { TaxonomyFormDialog } from "@/components/admin/taxonomy-form-dialog";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { listBlogTags, TAXONOMY_SORT_KEYS } from "@/services/blog-taxonomy";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Blog tags" };

export default async function BlogTagsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("post.view");
  const params = await searchParams;
  const canManage = can(viewer, "blog-taxonomy.manage");
  const sort = sortParams(params, TAXONOMY_SORT_KEYS, { sort: "name", order: "asc" });
  const { rows, total, page, pageSize } = await listBlogTags({
    search: firstParam(params.q),
    page: intParam(params.page),
    ...sort,
  });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: "name", header: "Name", sortable: true, cell: (t) => <span className="font-medium">{t.name}</span> },
    { key: "slug", header: "Slug", sortable: true, cell: (t) => t.slug },
    { key: "posts", header: "Posts", sortable: true, cell: (t) => t._count.posts },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (t: (typeof rows)[number]) => (
              <div className="flex gap-1.5">
                <TaxonomyFormDialog
                  kind="tag"
                  item={t}
                  trigger={<><Pencil aria-hidden /> Rename</>}
                  triggerLabel={`Rename tag ${t.name}`}
                  triggerVariant="ghost"
                />
                <ConfirmDialog
                  action={deleteBlogTag}
                  fields={{ id: String(t.id) }}
                  title={`Delete "${t.name}"?`}
                  description={
                    t._count.posts > 0
                      ? `The tag is removed from ${t._count.posts} post${t._count.posts === 1 ? "" : "s"}. The posts themselves are not changed.`
                      : "No posts use this tag."
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
        title="Blog tags"
        description="Free-form labels. Editors can also create tags while writing a post."
        actions={canManage && <TaxonomyFormDialog kind="tag" trigger={<><Plus aria-hidden /> New tag</>} triggerVariant="default" />}
      />
      <DataTable
        caption="Blog tags"
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        basePath="/admin/blog/tags"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No tags found"
        emptyDescription={canManage ? "Create a tag, or add one while editing a post." : "Nothing matches that search."}
        toolbar={<DataTableToolbar basePath="/admin/blog/tags" searchParams={params} searchPlaceholder="Search name or slug" />}
      />
    </>
  );
}
