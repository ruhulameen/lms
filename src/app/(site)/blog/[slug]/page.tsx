import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, Clock } from "lucide-react";
import { SidebarCourse } from "@/components/site/course-card";
import { SectionBadge } from "@/components/site/section-badge";
import { unsplash } from "@/lib/format";
import { getPostBySlug, type PostBlock } from "@/services/blog";
import { getRecommendedCourses } from "@/services/course";

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  return { title: post?.title ?? "Article not found" };
}

function Block({ block }: { block: PostBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="mt-10 mb-5 text-2xl font-bold text-navy md:text-[1.75rem]">
          {block.text}
        </h2>
      );
    case "quote":
      return (
        <blockquote className="my-7 rounded-r-lg border-l-4 border-blue-600 bg-blue-50 px-6 py-5 text-blue-900 italic">
          {block.text}
        </blockquote>
      );
    case "image":
      return (
        <Image
          src={unsplash(block.image, 1200)}
          alt=""
          width={1200}
          height={675}
          className="my-8 w-full rounded-xl"
        />
      );
    case "list":
      return (
        <ul className="mb-6 list-disc space-y-2 pl-6 leading-relaxed text-gray-700">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    default:
      return <p className="mb-6 leading-[1.8] text-gray-700">{block.text}</p>;
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const [post, courses] = await Promise.all([
    getPostBySlug(slug),
    getRecommendedCourses(),
  ]);
  if (!post) notFound();

  return (
    <>
      <div className="border-b border-gray-100 bg-white">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs text-gray-500 sm:px-6 lg:px-8"
        >
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-blue-600">
            Blog
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-800">{post.category}</span>
        </nav>
      </div>

      <header className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 lg:px-8">
          <SectionBadge className="mb-5">{post.category}</SectionBadge>
          <h1 className="mb-6 text-3xl leading-tight font-extrabold text-navy md:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            {post.excerpt}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <Image
                src={post.author.avatar}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-full object-cover"
              />
              <span className="font-semibold text-gray-700">
                By {post.author.name}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              Published {post.publishedAt}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-4" />
              {post.readTime}
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
          <Image
            src={unsplash(post.image, 1400)}
            alt=""
            width={1400}
            height={600}
            preload
            className="h-56 w-full rounded-2xl object-cover shadow-lg sm:h-[420px]"
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <article className="lg:col-span-2">
          {post.content ? (
            post.content.map((block, i) => <Block key={i} block={block} />)
          ) : (
            <p className="leading-[1.8] text-gray-700">{post.excerpt}</p>
          )}
        </article>
        <aside>
          <div className="rounded-xl border border-gray-200 bg-white p-5 lg:sticky lg:top-24">
            <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-100">
                <BookOpen className="size-4 text-blue-600" />
              </span>
              <h2 className="text-base font-bold text-navy">
                Recommended Courses
              </h2>
            </div>
            <div className="space-y-4">
              {courses.map((course) => (
                <SidebarCourse key={course.slug} course={course} />
              ))}
            </div>
            <Link
              href="/courses"
              className="mt-5 block text-center text-sm font-semibold text-blue-600 hover:underline"
            >
              View All Courses →
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
