import "server-only";
import { db } from "@/lib/db";
import { publicUrl, abortMultipartUpload, deleteObject, isStorageConfigured } from "@/lib/storage";
import type {
  MediaBreadcrumb,
  MediaFolderSummary,
  MediaKindValue,
  MediaSummary,
} from "@/lib/media-types";
import { mediaKinds } from "@/lib/media-types";
import type { Prisma } from "@/generated/prisma/client";

export const MEDIA_PAGE_SIZE = 24;
export const MEDIA_SORT_KEYS = ["date", "name", "size"] as const;
export type MediaSortKey = (typeof MEDIA_SORT_KEYS)[number];

export function isMediaKind(value: string | undefined): value is MediaKindValue {
  return mediaKinds.includes(value as MediaKindValue);
}

const summarySelect = {
  id: true,
  key: true,
  title: true,
  altText: true,
  originalFilename: true,
  kind: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  folderId: true,
  createdAt: true,
} satisfies Prisma.MediaSelect;

type SummaryRow = Prisma.MediaGetPayload<{ select: typeof summarySelect }>;

export function toSummary(row: SummaryRow): MediaSummary {
  return {
    id: row.id,
    title: row.title,
    altText: row.altText,
    filename: row.originalFilename,
    kind: row.kind,
    mimeType: row.mimeType,
    size: Number(row.size),
    width: row.width,
    height: row.height,
    url: publicUrl(row.key),
    folderId: row.folderId,
    createdAt: row.createdAt.toISOString(),
  };
}

export type MediaListFilters = {
  search?: string;
  kind?: MediaKindValue;
  // null = top level. Ignored while searching, which covers every folder.
  folderId: number | null;
  sort: MediaSortKey;
  order: "asc" | "desc";
  page: number;
  pageSize?: number;
};

// Admin data: call only after requirePermission("media.view").
export async function listMedia(filters: MediaListFilters) {
  const pageSize = filters.pageSize ?? MEDIA_PAGE_SIZE;
  const search = filters.search?.trim();
  const where: Prisma.MediaWhereInput = {
    uploadStatus: "READY",
    kind: filters.kind,
    folderId: search ? undefined : filters.folderId,
    OR: search
      ? [
          { originalFilename: { contains: search } },
          { title: { contains: search } },
          { altText: { contains: search } },
        ]
      : undefined,
  };
  const dir = filters.order;
  const orderBy: Prisma.MediaOrderByWithRelationInput[] = [
    filters.sort === "name"
      ? { originalFilename: dir }
      : filters.sort === "size"
        ? { size: dir }
        : { createdAt: dir },
    { id: "desc" },
  ];
  const [rows, total] = await Promise.all([
    db.media.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      select: summarySelect,
    }),
    db.media.count({ where }),
  ]);
  return { items: rows.map(toSummary), total, page: filters.page, pageSize };
}

// Subfolders of a folder (null = top level) with what they contain.
export async function listFolders(parentId: number | null): Promise<MediaFolderSummary[]> {
  const rows = await db.mediaFolder.findMany({
    where: { parentId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { media: { where: { uploadStatus: "READY" } }, children: true } },
    },
  });
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    itemCount: f._count.media,
    folderCount: f._count.children,
  }));
}

// Root-to-leaf path for the breadcrumb; empty for the top level.
export async function getFolderPath(folderId: number | null): Promise<MediaBreadcrumb[]> {
  const path: MediaBreadcrumb[] = [];
  let current = folderId;
  // Depth guard against a corrupted cycle.
  for (let i = 0; current !== null && i < 20; i++) {
    const folder: { id: number; name: string; parentId: number | null } | null =
      await db.mediaFolder.findUnique({
        where: { id: current },
        select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;
    path.unshift({ id: folder.id, name: folder.name });
    current = folder.parentId;
  }
  return path;
}

// Every folder with its full path, for "move to" selects.
export async function listFolderOptions() {
  const all = await db.mediaFolder.findMany({
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });
  const byId = new Map(all.map((f) => [f.id, f]));
  const label = (f: (typeof all)[number]): string => {
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    return parent ? `${label(parent)} / ${f.name}` : f.name;
  };
  return all.map((f) => ({ id: f.id, label: label(f) })).sort((a, b) => a.label.localeCompare(b.label));
}

// Admin data: call only after requirePermission("media.view").
export async function getMedia(id: number) {
  const row = await db.media.findUnique({
    where: { id },
    select: {
      ...summarySelect,
      caption: true,
      description: true,
      uploadStatus: true,
      uploadedBy: { select: { id: true, name: true } },
    },
  });
  if (!row || row.uploadStatus !== "READY") return null;
  return {
    ...toSummary(row),
    caption: row.caption,
    description: row.description,
    uploadedBy: row.uploadedBy,
  };
}

export type MediaUsage = { label: string; href: string | null };

// Where a file is referenced by a field (featured and social images).
// Images placed inside rich text bodies are not tracked.
export async function getMediaUsage(id: number): Promise<MediaUsage[]> {
  const [posts, seo] = await Promise.all([
    db.blogPost.findMany({ where: { featuredImageId: id }, select: { id: true, title: true } }),
    db.seoData.findMany({ where: { socialImageId: id }, select: { entityId: true } }),
  ]);
  const seoPosts = await db.blogPost.findMany({
    where: { id: { in: seo.map((s) => s.entityId) } },
    select: { id: true, title: true },
  });
  return [
    ...posts.map((p) => ({ label: `Featured image of post "${p.title}"`, href: `/admin/blog/${p.id}` })),
    ...seo.map((s) => {
      const post = seoPosts.find((p) => p.id === s.entityId);
      return { label: `Social image of post "${post?.title ?? `#${s.entityId}`}"`, href: `/admin/blog/${s.entityId}` };
    }),
  ];
}

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

// Removes uploads that never finished (browser closed, network lost): aborts the
// multipart upload, deletes any stored object and the row. Nothing schedules it
// yet; call it from a cron route or admin action when one exists.
export async function cleanupStaleUploads(now = new Date()) {
  const stale = await db.media.findMany({
    where: { uploadStatus: "PENDING", createdAt: { lt: new Date(now.getTime() - STALE_UPLOAD_MS) } },
    select: { id: true, key: true, multipartUploadId: true },
  });
  let removed = 0;
  for (const row of stale) {
    if (isStorageConfigured()) {
      try {
        if (row.multipartUploadId) await abortMultipartUpload(row.key, row.multipartUploadId);
        await deleteObject(row.key);
      } catch (error) {
        console.error(`Failed to clean up upload ${row.id}`, error);
        continue;
      }
    }
    await db.media.delete({ where: { id: row.id } });
    removed++;
  }
  return { found: stale.length, removed };
}

// One READY file as a summary, e.g. to show the current value of a media field.
export async function getMediaSummary(id: number | null | undefined) {
  if (!id) return null;
  const row = await db.media.findFirst({ where: { id, uploadStatus: "READY" }, select: summarySelect });
  return row ? toSummary(row) : null;
}
