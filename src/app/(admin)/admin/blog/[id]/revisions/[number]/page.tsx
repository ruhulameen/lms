import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { restorePostRevision } from "@/actions/post";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { RevisionCompare } from "@/components/admin/revision-compare";
import { RichText } from "@/components/site/rich-text";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/activity-details";
import { allowedTransitions } from "@/lib/content-status";
import { parseRouteId } from "@/lib/route-id";
import { getPostHeading } from "@/services/post";
import { getCurrentPostSnapshot, getPostRevision } from "@/services/revision";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Revision" };

export default async function PostRevisionPage({ params }: { params: Promise<{ id: string; number: string }> }) {
  const viewer = await requirePermission("post.view");
  const { id: rawId, number: rawNumber } = await params;
  const id = parseRouteId(rawId);
  const number = parseRouteId(rawNumber);
  if (!id || !number) notFound();
  const [post, revision, current] = await Promise.all([getPostHeading(id), getPostRevision(id, number), getCurrentPostSnapshot(id)]);
  if (!post || !revision || !current) notFound();

  const { snapshot } = revision;
  const canRestore =
    can(viewer, "post.edit") &&
    allowedTransitions(post.status, { canEdit: true, canPublish: can(viewer, "post.publish") }).length > 0;

  return (
    <>
      <PageHeader
        title={`Revision ${revision.number}`}
        description={`${post.title} · saved ${formatDateTime(revision.createdAt)} by ${revision.createdBy?.name ?? "unknown"}${revision.note ? ` · ${revision.note}` : ""}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/admin/blog/${id}/revisions`} />}>All revisions</Button>
            {canRestore && (
              <ConfirmDialog
                action={restorePostRevision}
                fields={{ id: String(id), number: String(number) }}
                title={`Restore revision ${number}?`}
                description="The title, body, excerpt, SEO settings, category and tags go back to this version. The status stays as it is, and the current version is kept as a revision."
                trigger={<><RotateCcw aria-hidden /> Restore this version</>}
                confirmLabel="Restore"
              />
            )}
          </>
        }
      />
      <div className="grid gap-6">
        <section aria-labelledby="changes" className="rounded-xl border bg-white p-4 sm:p-6">
          <h2 id="changes" className="mb-3 text-base font-bold text-slate-900">Compared with the current version</h2>
          <RevisionCompare
            before={{ label: `Revision ${revision.number}`, snapshot }}
            after={{ label: "Current version", snapshot: current }}
          />
        </section>
        <section aria-labelledby="content" className="rounded-xl border bg-white p-4 sm:p-6">
          <h2 id="content" className="mb-3 text-base font-bold text-slate-900">Content of this revision</h2>
          <p className="text-lg font-bold text-navy">{snapshot.title}</p>
          <p className="mb-4 text-sm text-slate-500">/blog/{snapshot.slug}</p>
          {snapshot.excerpt && <p className="mb-4 text-sm text-slate-600">{snapshot.excerpt}</p>}
          <RichText doc={snapshot.body} />
        </section>
      </div>
    </>
  );
}
