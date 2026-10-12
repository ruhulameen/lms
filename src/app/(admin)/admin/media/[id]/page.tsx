import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, File, Trash2 } from "lucide-react";
import { deleteMedia } from "@/actions/media";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { CopyUrlButton } from "@/components/admin/copy-url-button";
import { MediaDetailsForm } from "@/components/admin/media-details-form";
import { MediaMoveForm } from "@/components/admin/media-move-form";
import { MediaThumb } from "@/components/admin/media-thumb";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/activity-details";
import { formatBytes, mediaKindLabels } from "@/lib/media-types";
import { getFolderPath, getMedia, getMediaUsage, listFolderOptions } from "@/services/media";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Media details" };

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("media.view");
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const media = await getMedia(id);
  if (!media) notFound();

  const canEdit = can(viewer, "media.edit");
  const canDelete = can(viewer, "media.delete");
  const [usage, folders, path] = await Promise.all([
    getMediaUsage(id),
    canEdit ? listFolderOptions() : Promise.resolve([]),
    getFolderPath(media.folderId),
  ]);

  const facts: [string, string][] = [
    ["Type", `${mediaKindLabels[media.kind]} (${media.mimeType})`],
    ["Size", formatBytes(media.size)],
    ...(media.width && media.height ? ([["Dimensions", `${media.width} x ${media.height} px`]] as [string, string][]) : []),
    ["Folder", path.length ? path.map((p) => p.name).join(" / ") : "Top level"],
    ["Uploaded by", media.uploadedBy?.name ?? "Unknown"],
    ["Uploaded", formatDate(new Date(media.createdAt))],
  ];

  return (
    <>
      <PageHeader
        title={media.title || media.filename}
        description={media.filename}
        actions={
          <>
            <Button variant="outline" render={<Link href={media.folderId ? `/admin/media?folder=${media.folderId}` : "/admin/media"} />}>
              <ArrowLeft aria-hidden /> Back to media
            </Button>
            {canDelete && (
              <ConfirmDialog
                action={deleteMedia}
                fields={{ id: String(media.id) }}
                title="Delete this file?"
                description="The file is removed from storage and cannot be recovered."
                trigger={
                  <>
                    <Trash2 aria-hidden /> Delete
                  </>
                }
                confirmLabel="Delete file"
                destructive
              />
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <div className="overflow-hidden rounded-xl border bg-white p-3">
            <Preview media={media} />
          </div>

          <section aria-labelledby="facts" className="rounded-xl border bg-white p-4">
            <h2 id="facts" className="mb-3 text-sm font-semibold text-slate-900">File details</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {media.url && (
              <div className="mt-4 flex items-center gap-2">
                <label htmlFor="media-url" className="sr-only">Public URL</label>
                <Input id="media-url" readOnly value={media.url} className="min-w-0 flex-1" />
                <CopyUrlButton value={media.url} />
              </div>
            )}
          </section>

          <section aria-labelledby="usage" className="rounded-xl border bg-white p-4">
            <h2 id="usage" className="mb-3 text-sm font-semibold text-slate-900">Where it is used</h2>
            {usage.length === 0 ? (
              <p className="text-sm text-slate-500">
                Not used as a featured or social image. Images placed inside page text are not tracked.
              </p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {usage.map((u) => (
                  <li key={u.label}>
                    {u.href ? (
                      <Link href={u.href} className="text-blue-700 hover:underline">{u.label}</Link>
                    ) : (
                      u.label
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid content-start gap-4">
          <section aria-labelledby="edit" className="rounded-xl border bg-white p-4">
            <h2 id="edit" className="mb-3 text-sm font-semibold text-slate-900">Edit details</h2>
            <MediaDetailsForm
              readOnly={!canEdit}
              media={{
                id: media.id,
                filename: media.filename,
                title: media.title,
                altText: media.altText,
                caption: media.caption,
                description: media.description,
                isImage: media.kind === "IMAGE",
              }}
            />
          </section>
          {canEdit && (
            <section aria-labelledby="move" className="rounded-xl border bg-white p-4">
              <h2 id="move" className="mb-3 text-sm font-semibold text-slate-900">Move to a folder</h2>
              <MediaMoveForm mediaId={media.id} folderId={media.folderId} folders={folders} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Preview({ media }: { media: NonNullable<Awaited<ReturnType<typeof getMedia>>> }) {
  if (media.kind === "IMAGE") {
    return (
      <span className="relative block aspect-video overflow-hidden rounded-lg bg-slate-100">
        {media.url ? (
          <MediaThumb media={media} sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
        ) : (
          <MediaThumb media={media} />
        )}
      </span>
    );
  }
  if (media.kind === "VIDEO" && media.url) {
    return (
      <video src={media.url} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
    );
  }
  if (media.kind === "PDF" && media.url) {
    return <iframe src={media.url} title={`Preview of ${media.filename}`} className="h-[28rem] w-full rounded-lg border" />;
  }
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
      <File className="size-12" aria-hidden />
      <p className="text-sm">No preview for this file type.</p>
      {media.url && (
        <Button variant="outline" size="sm" render={<a href={media.url} download />}>
          <Download aria-hidden /> Download
        </Button>
      )}
    </div>
  );
}
