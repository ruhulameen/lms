import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Folder, FolderPlus, Grid3x3, List, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { deleteFolder } from "@/actions/media";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  DataTable,
  DataTableToolbar,
  FilterSelect,
  ListPagination,
  type DataTableColumn,
} from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { FolderFormDialog } from "@/components/admin/media-folder-dialogs";
import { MediaThumb } from "@/components/admin/media-thumb";
import { MediaUploader } from "@/components/admin/media-uploader";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/activity-details";
import { formatBytes, mediaKindLabels, mediaKinds, type MediaSummary } from "@/lib/media-types";
import { isStorageConfigured } from "@/lib/storage";
import { firstParam, intParam, listHref, sortParams, type SearchParams } from "@/lib/table-params";
import {
  getFolderPath,
  isMediaKind,
  listFolders,
  listMedia,
  MEDIA_SORT_KEYS,
} from "@/services/media";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Media" };

const BASE = "/admin/media";

export default async function MediaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("media.view");
  const params = await searchParams;

  const view = firstParam(params.view) === "list" ? "list" : "grid";
  const search = firstParam(params.q)?.trim() || undefined;
  const kindParam = firstParam(params.kind);
  const kind = isMediaKind(kindParam) ? kindParam : undefined;
  const folderParam = intParam(params.folder, 0);
  const sort = sortParams(params, MEDIA_SORT_KEYS, { sort: "date", order: "desc" });

  const path = await getFolderPath(folderParam || null);
  // A deleted or unknown folder id falls back to the top level.
  const folderId = path.at(-1)?.id ?? null;
  const [{ items, total, page, pageSize }, folders] = await Promise.all([
    listMedia({ search, kind, folderId, ...sort, page: intParam(params.page) }),
    search ? Promise.resolve([]) : listFolders(folderId),
  ]);

  const configured = isStorageConfigured();
  const canUpload = can(viewer, "media.upload");
  const canEdit = can(viewer, "media.edit");
  const canDelete = can(viewer, "media.delete");
  const filtered = Boolean(search || kind);

  const columns: DataTableColumn<MediaSummary>[] = [
    {
      key: "preview",
      header: "Preview",
      className: "w-16",
      cell: (m) => (
        <span className="relative block size-10 overflow-hidden rounded-md">
          <MediaThumb media={m} sizes="40px" />
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (m) => (
        <Link href={`${BASE}/${m.id}`} className="font-medium text-blue-700 hover:underline">
          {m.title || m.filename}
        </Link>
      ),
    },
    { key: "kind", header: "Type", cell: (m) => <StatusBadge label={mediaKindLabels[m.kind]} tone="neutral" /> },
    { key: "size", header: "Size", sortable: true, cell: (m) => formatBytes(m.size) },
    { key: "dimensions", header: "Dimensions", cell: (m) => (m.width && m.height ? `${m.width} x ${m.height}` : "-") },
    { key: "date", header: "Uploaded", sortable: true, cell: (m) => formatDate(new Date(m.createdAt)) },
  ];

  const toolbar = (
    <DataTableToolbar basePath={BASE} searchParams={params} keepParams={["view", "folder"]} searchPlaceholder="Search name, title or alt text">
      <FilterSelect
        name="kind"
        label="All types"
        searchParams={params}
        options={mediaKinds.map((k) => ({ value: k, label: mediaKindLabels[k] }))}
      />
    </DataTableToolbar>
  );

  return (
    <>
      <PageHeader
        title="Media"
        description="Images, videos, PDFs and documents used across the site."
        actions={
          <>
            <ViewToggle params={params} view={view} />
            {canUpload && (
              <FolderFormDialog
                parentId={folderId}
                triggerLabel="New folder"
                trigger={
                  <>
                    <FolderPlus aria-hidden /> New folder
                  </>
                }
              />
            )}
          </>
        }
      />

      {!configured && (
        <div role="status" className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Storage is not configured.</strong> Uploads are disabled until
            R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL are set in the
            environment. Existing files cannot be previewed or deleted without them.
          </p>
        </div>
      )}

      {canUpload && configured && <MediaUploader folderId={folderId} className="mb-4" />}

      <nav aria-label="Folder path" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        <Link href={listHref(BASE, params, { folder: undefined, page: undefined })} className="font-medium text-blue-700 hover:underline">
          All media
        </Link>
        {path.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
            {i === path.length - 1 ? (
              <span aria-current="page" className="font-semibold text-slate-900">{crumb.name}</span>
            ) : (
              <Link href={listHref(BASE, params, { folder: String(crumb.id), page: undefined })} className="text-blue-700 hover:underline">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
        {folderId !== null && (
          <span className="ml-auto flex gap-2">
            {canEdit && (
              <FolderFormDialog
                folder={{ id: folderId, name: path.at(-1)!.name }}
                triggerLabel={`Rename folder ${path.at(-1)!.name}`}
                trigger={
                  <>
                    <Pencil aria-hidden /> Rename
                  </>
                }
              />
            )}
            {canDelete && (
              <ConfirmDialog
                action={deleteFolder}
                fields={{ id: String(folderId) }}
                title={`Delete folder "${path.at(-1)!.name}"?`}
                description="Only empty folders can be deleted. Files and subfolders must be moved or deleted first."
                trigger={
                  <>
                    <Trash2 aria-hidden /> Delete
                  </>
                }
                triggerLabel={`Delete folder ${path.at(-1)!.name}`}
                confirmLabel="Delete folder"
                destructive
              />
            )}
          </span>
        )}
      </nav>

      {folders.length > 0 && (
        <ul aria-label="Folders" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => (
            <li key={f.id}>
              <Link
                href={listHref(BASE, params, { folder: String(f.id), page: undefined })}
                className="flex items-center gap-3 rounded-xl border bg-white p-3 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Folder className="size-5 shrink-0 text-blue-600" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-slate-500">
                    {f.itemCount} {f.itemCount === 1 ? "file" : "files"}
                    {f.folderCount > 0 && `, ${f.folderCount} ${f.folderCount === 1 ? "folder" : "folders"}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {view === "list" ? (
        <DataTable
          caption="Media files"
          columns={columns}
          rows={items}
          rowKey={(m) => m.id}
          basePath={BASE}
          searchParams={params}
          sort={sort}
          page={page}
          pageSize={pageSize}
          total={total}
          toolbar={toolbar}
          emptyTitle={filtered ? "No files match" : "No files here yet"}
          emptyDescription={filtered ? "Try a different search or clear the filters." : "Uploaded files will appear here."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-3 sm:p-4">
            {toolbar}
            <GridSort params={params} sort={sort} />
          </div>
          {items.length === 0 ? (
            <EmptyState
              title={filtered ? "No files match" : "No files here yet"}
              description={filtered ? "Try a different search or clear the filters." : "Uploaded files will appear here."}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4 md:grid-cols-4 xl:grid-cols-6">
              {items.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`${BASE}/${m.id}`}
                    className="group block overflow-hidden rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="relative block aspect-square bg-slate-100">
                      <MediaThumb media={m} sizes="(min-width: 1280px) 12vw, (min-width: 768px) 20vw, 45vw" />
                    </span>
                    <span className="block p-2">
                      <span className="block truncate text-sm font-medium group-hover:underline">{m.title || m.filename}</span>
                      <span className="block text-xs text-slate-500">
                        {mediaKindLabels[m.kind]} - {formatBytes(m.size)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <ListPagination basePath={BASE} searchParams={params} page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </>
  );
}

function ViewToggle({ params, view }: { params: SearchParams; view: "grid" | "list" }) {
  const options = [
    { value: "grid", label: "Grid view", icon: Grid3x3 },
    { value: "list", label: "List view", icon: List },
  ] as const;
  return (
    <div role="group" aria-label="View" className="flex rounded-lg border bg-white p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          size="icon-sm"
          variant={view === value ? "default" : "ghost"}
          aria-label={label}
          aria-pressed={view === value}
          render={<Link href={listHref(BASE, params, { view: value === "grid" ? undefined : value, page: undefined })} />}
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}

function GridSort({ params, sort }: { params: SearchParams; sort: { sort: string; order: "asc" | "desc" } }) {
  const options = [
    { key: "date", label: "Date" },
    { key: "name", label: "Name" },
    { key: "size", label: "Size" },
  ];
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
      Sort by
      {options.map((o) => {
        const active = sort.sort === o.key;
        return (
          <Link
            key={o.key}
            href={listHref(BASE, params, { sort: o.key, order: active && sort.order === "asc" ? "desc" : "asc", page: undefined })}
            aria-current={active ? "true" : undefined}
            className={active ? "font-semibold text-slate-900 underline" : "text-blue-700 hover:underline"}
          >
            {o.label}
            {active && (sort.order === "asc" ? " (ascending)" : " (descending)")}
          </Link>
        );
      })}
    </p>
  );
}
