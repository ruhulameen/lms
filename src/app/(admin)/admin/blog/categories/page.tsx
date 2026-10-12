import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteBlogCategory } from "@/actions/blog-taxonomy";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { TaxonomyFormDialog } from "@/components/admin/taxonomy-form-dialog";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { listBlogCategories, TAXONOMY_SORT_KEYS } from "@/services/blog-taxonomy";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Blog categories" };

export default async function BlogCategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("post.view");
  const params = await searchParams;
  const canManage = can(viewer, "blog-taxonomy.manage");
  const sort = sortParams(params, TAXONOMY_SORT_KEYS, { sort: "name", order: "asc" });
  const { rows, total, page, pageSize } = await listBlogCategories({
    search: firstParam(params.q),
    page: intParam(params.page),
    ...sort,
  });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    { key: "name", header: "Name", sortable: true, cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "slug", header: "Slug", sortable: true, cell: (c) => c.slug },
    {
      key: "description",
      header: "Description",
      className: "max-w-xs truncate",
      cell: (c) => c.description ?? <span className="text-slate-400">None</span>,
    },
    {
      key: "posts",
      header: "Posts",
      sortable: true,
      cell: (c) =>
        c._count.posts > 0 ? (
          <Link href={`/admin/blog?category=${c.id}`} className="text-blue-700 hover:underline">
            {c._count.posts}
          </Link>
        ) : (
          0
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (c: (typeof rows)[number]) => (
              <div className="flex gap-1.5">
                <TaxonomyFormDialog
                  kind="category"
                  item={c}
                  trigger={<><Pencil aria-hidden /> Edit</>}
                  triggerLabel={`Edit category ${c.name}`}
                  triggerVariant="ghost"
                />
                <ConfirmDialog
                  action={deleteBlogCategory}
                  fields={{ id: String(c.id) }}
                  title={`Delete "${c.name}"?`}
                  description={
                    c._count.posts > 0
                      ? `${c._count.posts} post${c._count.posts === 1 ? " uses" : "s use"} this category. They stay published and become uncategorised.`
                      : "No posts use this category."
                  }
                  trigger={<><Trash2 aria-hidden /> Delete</>}
                  triggerVariant="ghost"
                  triggerLabel={`Delete category ${c.name}`}
                  confirmLabel="Delete category"
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
        title="Blog categories"
        description="Each post belongs to at most one category."
        actions={
          canManage && (
            <TaxonomyFormDialog kind="category" trigger={<><Plus aria-hidden /> New category</>} triggerVariant="default" />
          )
        }
      />
      <DataTable
        caption="Blog categories"
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        basePath="/admin/blog/categories"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No categories found"
        emptyDescription={canManage ? "Create a category to group posts." : "Nothing matches that search."}
        toolbar={<DataTableToolbar basePath="/admin/blog/categories" searchParams={params} searchPlaceholder="Search name or slug" />}
      />
    </>
  );
}
