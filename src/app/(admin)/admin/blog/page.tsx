import type { Metadata } from "next";
import Link from "next/link";
import { Copy, Eye, Plus, Star, Trash2, Undo2, Upload } from "lucide-react";
import { deletePost, duplicatePost, setPostStatus } from "@/actions/post";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/activity-details";
import { contentStatuses, contentStatusMeta } from "@/lib/content-status";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { listCategoryOptions } from "@/services/blog-taxonomy";
import { listPostAuthorFilter, listPosts, POST_SORT_KEYS } from "@/services/post";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Posts" };

const idParam = (value: string | string[] | undefined) => {
  const raw = firstParam(value);
  return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("post.view");
  const params = await searchParams;

  const status = contentStatuses.find((s) => s === firstParam(params.status));
  const sort = sortParams(params, POST_SORT_KEYS, { sort: "updated", order: "desc" });
  const [{ rows, total, page, pageSize }, categories, authors] = await Promise.all([
    listPosts({
      search: firstParam(params.q),
      status,
      categoryId: idParam(params.category),
      authorId: idParam(params.author),
      page: intParam(params.page),
      ...sort,
    }),
    listCategoryOptions(),
    listPostAuthorFilter(),
  ]);

  const canPublish = can(viewer, "post.publish");
  const canCreate = can(viewer, "post.create");
  const canDelete = can(viewer, "post.delete");

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      className: "max-w-xs whitespace-normal",
      cell: (p) => (
        <Link href={`/admin/blog/${p.id}`} className="font-medium text-blue-700 hover:underline">
          {p.title}
          {p.featured && <Star className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-500" aria-label="Featured" />}
        </Link>
      ),
    },
    { key: "status", header: "Status", sortable: true, cell: (p) => <ContentStatusBadge status={p.status} /> },
    { key: "category", header: "Category", sortable: true, cell: (p) => p.category?.name ?? <span className="text-slate-400">None</span> },
    { key: "author", header: "Author", sortable: true, cell: (p) => p.author?.name ?? <span className="text-slate-400">None</span> },
    {
      key: "date",
      header: "Published",
      sortable: true,
      cell: (p) =>
        p.status === "SCHEDULED" && p.publishAt
          ? `Scheduled ${formatDateTime(p.publishAt)}`
          : p.publishedAt
            ? formatDate(p.publishedAt)
            : <span className="text-slate-400">Not yet</span>,
    },
    { key: "updated", header: "Updated", sortable: true, cell: (p) => formatDate(p.updatedAt) },
    {
      key: "actions",
      header: "Actions",
      cell: (p) => (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" size="sm" render={<Link href={`/admin/blog/${p.id}/preview`} />} aria-label={`Preview ${p.title}`}>
            <Eye aria-hidden /> Preview
          </Button>
          {canPublish && p.status !== "PUBLISHED" && (
            <ConfirmDialog
              action={setPostStatus}
              fields={{ id: String(p.id), status: "PUBLISHED" }}
              title="Publish this post?"
              description={`"${p.title}" goes live on the public blog straight away.`}
              trigger={<><Upload aria-hidden /> Publish</>}
              triggerVariant="ghost"
              triggerLabel={`Publish ${p.title}`}
              confirmLabel="Publish"
            />
          )}
          {canPublish && (p.status === "PUBLISHED" || p.status === "SCHEDULED") && (
            <ConfirmDialog
              action={setPostStatus}
              fields={{ id: String(p.id), status: "DRAFT" }}
              title="Unpublish this post?"
              description={`"${p.title}" is taken off the public blog and saved as a draft.`}
              trigger={<><Undo2 aria-hidden /> Unpublish</>}
              triggerVariant="ghost"
              triggerLabel={`Unpublish ${p.title}`}
              confirmLabel="Unpublish"
            />
          )}
          {canCreate && (
            <ConfirmDialog
              action={duplicatePost}
              fields={{ id: String(p.id) }}
              title="Duplicate this post?"
              description="A copy is created as a draft with a new slug."
              trigger={<><Copy aria-hidden /> Duplicate</>}
              triggerVariant="ghost"
              triggerLabel={`Duplicate ${p.title}`}
              confirmLabel="Duplicate"
            />
          )}
          {canDelete && (
            <ConfirmDialog
              action={deletePost}
              fields={{ id: String(p.id) }}
              title="Delete this post?"
              description={`"${p.title}", its revisions and its SEO settings are deleted for good.`}
              trigger={<><Trash2 aria-hidden /> Delete</>}
              triggerVariant="ghost"
              triggerLabel={`Delete ${p.title}`}
              confirmLabel="Delete post"
              destructive
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Posts"
        description="Blog articles: write, review, schedule and publish."
        actions={
          <>
            <Button variant="outline" render={<Link href="/admin/blog/categories" />}>Categories and tags</Button>
            {canCreate && (
              <Button render={<Link href="/admin/blog/new" />}>
                <Plus aria-hidden /> New post
              </Button>
            )}
          </>
        }
      />
      {firstParam(params.deleted) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Post deleted.
        </p>
      )}
      <DataTable
        caption="Posts"
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        basePath="/admin/blog"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No posts found"
        emptyDescription={canCreate ? "Try different filters, or write the first post." : "Try a different search or clear the filters."}
        toolbar={
          <DataTableToolbar basePath="/admin/blog" searchParams={params} searchPlaceholder="Search title or slug">
            <FilterSelect
              name="status"
              label="All statuses"
              searchParams={params}
              options={contentStatuses.map((s) => ({ value: s, label: contentStatusMeta[s].label }))}
            />
            <FilterSelect
              name="category"
              label="All categories"
              searchParams={params}
              options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            />
            <FilterSelect
              name="author"
              label="All authors"
              searchParams={params}
              options={authors.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </DataTableToolbar>
        }
      />
    </>
  );
}
