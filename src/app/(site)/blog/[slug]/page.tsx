import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/site/post-article";
import { postMetadataFields } from "@/lib/blog-post";
import { getPostBySlug, getPostMetadataSource, getRelatedPosts } from "@/services/blog";
import { getRecommendedCourses } from "@/services/course";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Article not found" };

  const source = await getPostMetadataSource(post.id);
  const meta = postMetadataFields({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    ...source,
  });
  return {
    metadataBase: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : undefined,
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    robots: meta.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      title: meta.title,
      description: meta.description,
      publishedTime: post.date.toISOString(),
      images: meta.image ? [meta.image] : undefined,
    },
    twitter: { card: meta.image ? "summary_large_image" : "summary", title: meta.title, description: meta.description },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const [courses, related] = await Promise.all([getRecommendedCourses(), getRelatedPosts(post)]);
  return <PostArticle post={post} courses={courses} related={related} />;
}
