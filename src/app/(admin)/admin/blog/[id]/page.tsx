import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Eye, History, Trash2 } from "lucide-react";
import { deletePost, duplicatePost } from "@/actions/post";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { PostForm } from "@/components/admin/post-form";
import { Button } from "@/components/ui/button";
import { allowedTransitions, isPublic } from "@/lib/content-status";
import { parseRouteId } from "@/lib/route-id";
import { emptyDocumentCopy, sanitizeDocument } from "@/lib/rich-text";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { listCategoryOptions, listTagOptions } from "@/services/blog-taxonomy";
import { getPostForEdit, listAuthorOptions } from "@/services/post";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermission("post.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;

  const post = await getPostForEdit(id);
  if (!post) notFound();
  const [categories, tags, authors] = await Promise.all([
    listCategoryOptions(),
    listTagOptions(),
    listAuthorOptions(post.authorId),
  ]);

  const canPublish = can(viewer, "post.publish");
  const canEditPermission = can(viewer, "post.edit");
  const workflowAllows = allowedTransitions(post.status, { canEdit: true, canPublish }).length > 0;
  const canEdit = canEditPermission && workflowAllows;
  const lockedReason = !canEditPermission
    ? "You can view this post but not change it."
    : !workflowAllows
      ? "This post is published, scheduled or archived. Only someone who can publish posts may change it."
      : undefined;

  let body;
  try {
    body = sanitizeDocument(post.body);
  } catch {
    body = emptyDocumentCopy();
  }

  return (
    <>
      <PageHeader
        title={post.title}
        description={`/blog/${post.slug}`}
        actions={
          <>
            <ContentStatusBadge status={post.status} className="self-center" />
            {isPublic(post.status, post.publishAt) && (
              <Button variant="outline" render={<Link href={`/blog/${post.slug}`} target="_blank" />}>
                <ExternalLink aria-hidden /> View live
              </Button>
            )}
            <Button variant="outline" render={<Link href={`/admin/blog/${post.id}/preview`} />}>
              <Eye aria-hidden /> Preview
            </Button>
            <Button variant="outline" render={<Link href={`/admin/blog/${post.id}/revisions`} />}>
              <History aria-hidden /> Revisions
            </Button>
            {can(viewer, "post.create") && (
              <ConfirmDialog
                action={duplicatePost}
                fields={{ id: String(post.id) }}
                title="Duplicate this post?"
                description="A copy is created as a draft with a new slug, and opened for editing."
                trigger={<><Copy aria-hidden /> Duplicate</>}
                confirmLabel="Duplicate"
              />
            )}
            {can(viewer, "post.delete") && (
              <ConfirmDialog
                action={deletePost}
                fields={{ id: String(post.id), redirect: "list" }}
                title="Delete this post?"
                description={`"${post.title}", its revisions and its SEO settings are deleted for good.`}
                trigger={<><Trash2 aria-hidden /> Delete</>}
                triggerVariant="destructive"
                confirmLabel="Delete post"
                destructive
              />
            )}
          </>
        }
      />
      {firstParam(query.created) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Post created.
        </p>
      )}
      <PostForm
        key={post.updatedAt.toISOString()}
        mode="edit"
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body,
          featuredImage: post.featuredImage,
          categoryId: post.categoryId,
          tagIds: post.tagIds,
          authorId: post.authorId,
          featured: post.featured,
          status: post.status,
          publishAt: post.publishAt?.toISOString() ?? null,
          seo: post.seo,
          socialImage: post.socialImage,
        }}
        categories={categories}
        tags={tags}
        authors={authors}
        currentUserId={viewer.id}
        canEdit={canEdit}
        canPublish={canPublish}
        canCreateTags={can(viewer, "blog-taxonomy.manage")}
        lockedReason={lockedReason}
      />
    </>
  );
}
