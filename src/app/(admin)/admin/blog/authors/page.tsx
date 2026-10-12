import type { Metadata } from "next";
import Link from "next/link";
import { AuthorBioDialog } from "@/components/admin/author-bio-dialog";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { AUTHOR_SORT_KEYS, listAuthors } from "@/services/author";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Blog authors" };

export default async function BlogAuthorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("post.view");
  const params = await searchParams;
  const sort = sortParams(params, AUTHOR_SORT_KEYS, { sort: "name", order: "asc" });
  const { rows, total, page, pageSize } = await listAuthors({
    search: firstParam(params.q),
    page: intParam(params.page),
    ...sort,
  });

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "Author",
      sortable: true,
      cell: (a) => (
        <Link href={`/admin/blog?author=${a.id}`} className="font-medium text-blue-700 hover:underline">
          {a.name}
        </Link>
      ),
    },
    { key: "posts", header: "Published / total", sortable: true, cell: (a) => `${a.published} / ${a.total}` },
    {
      key: "bio",
      header: "Public bio",
      className: "max-w-md whitespace-normal",
      cell: (a) => (a.bio ? <span className="line-clamp-2 text-slate-700">{a.bio}</span> : <span className="text-slate-400">No bio yet</span>),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (a) =>
        a.id === viewer.id || can(viewer, "user.edit") ? <AuthorBioDialog author={a} /> : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Blog authors"
        description="Everyone who has written a post. A bio appears under their articles; authors can edit their own."
      />
      <DataTable
        caption="Blog authors"
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        basePath="/admin/blog/authors"
        searchParams={params}
        sort={sort}
        page={page}
        pageSize={pageSize}
        total={total}
        emptyTitle="No authors yet"
        emptyDescription="Authors appear here once they have a post."
        toolbar={<DataTableToolbar basePath="/admin/blog/authors" searchParams={params} searchPlaceholder="Search name or email" />}
      />
    </>
  );
}
