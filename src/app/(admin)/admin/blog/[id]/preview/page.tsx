import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentStatusBadge } from "@/components/admin/content-status-badge";
import { PostArticle } from "@/components/site/post-article";
import { parseRouteId } from "@/lib/route-id";
import { getRelatedPosts } from "@/services/blog";
import { getRecommendedCourses } from "@/services/course";
import { getPostPreview } from "@/services/post";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

// The public article layout for any post, whatever its status.
export default async function PostPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("post.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const preview = await getPostPreview(id);
  if (!preview) notFound();
  const [courses, related] = await Promise.all([getRecommendedCourses(), getRelatedPosts(preview.post)]);

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-amber-100 px-4 py-2.5 text-sm text-amber-950">
        <span className="flex items-center gap-2">
          <strong>Preview — not published.</strong>
          <ContentStatusBadge status={preview.status} />
        </span>
        <Link href={`/admin/blog/${preview.post.id}`} className="font-medium underline">
          Back to the editor
        </Link>
      </div>
      <div className="bg-slate-50 text-gray-800">
        <PostArticle post={preview.post} courses={courses} related={related} />
      </div>
    </div>
  );
}
