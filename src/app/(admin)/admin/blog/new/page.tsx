import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PostForm } from "@/components/admin/post-form";
import { listCategoryOptions, listTagOptions } from "@/services/blog-taxonomy";
import { listAuthorOptions } from "@/services/post";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  const user = await requirePermission("post.create");
  const [categories, tags, authors] = await Promise.all([listCategoryOptions(), listTagOptions(), listAuthorOptions(user.id)]);

  return (
    <>
      <PageHeader title="New post" description="Write the post, then save it as a draft or submit it for review." />
      <PostForm
        mode="create"
        categories={categories}
        tags={tags}
        authors={authors}
        currentUserId={user.id}
        canEdit
        canPublish={can(user, "post.publish")}
        canCreateTags={can(user, "blog-taxonomy.manage")}
      />
    </>
  );
}
