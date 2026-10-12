import Link from "next/link";
import { BookOpen, CalendarDays, Clock } from "lucide-react";
import { PostImage } from "@/components/site/post-image";
import { RichText } from "@/components/site/rich-text";
import { SectionBadge } from "@/components/site/section-badge";
import { SidebarCourse } from "@/components/site/course-card";
import { UserAvatar } from "@/components/site/user-avatar";
import { formatPostDate } from "@/lib/blog-post";
import type { BlogPost } from "@/services/blog";
import type { getRecommendedCourses } from "@/services/course";

type PostArticleProps = {
  post: BlogPost;
  courses: Awaited<ReturnType<typeof getRecommendedCourses>>;
  related: BlogPost[];
};

// The article layout, shared by the public page and the admin preview.
export function PostArticle({ post, courses, related }: PostArticleProps) {
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
          {post.category && (
            <>
              <span>/</span>
              <Link href={`/blog?category=${post.category.slug}`} className="font-medium text-gray-800 hover:text-blue-600">
                {post.category.name}
              </Link>
            </>
          )}
        </nav>
      </div>

      <header className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 lg:px-8">
          {post.category && <SectionBadge className="mb-5">{post.category.name}</SectionBadge>}
          <h1 className="mb-6 text-3xl leading-tight font-extrabold text-navy md:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.excerpt && <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">{post.excerpt}</p>}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            {post.author && (
              <span className="flex items-center gap-2">
                <UserAvatar name={post.author.name} image={post.author.image} className="size-8 text-xs" />
                <span className="font-semibold text-gray-700">By {post.author.name}</span>
              </span>
            )}
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              Published {formatPostDate(post.date)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-4" />
              {post.readTime}
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="relative h-56 w-full overflow-hidden rounded-2xl shadow-lg sm:h-[420px]">
            <PostImage image={post.image} sizes="(min-width: 1024px) 1024px, 100vw" preload />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <article className="lg:col-span-2">
          <RichText doc={post.body} />

          {post.tags.length > 0 && (
            <ul aria-label="Tags" className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={`/blog?tag=${tag.slug}`}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-300 hover:text-blue-600"
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {post.author && (
            <aside aria-label="About the author" className="mt-10 flex gap-4 rounded-xl border border-gray-200 bg-white p-5">
              <UserAvatar name={post.author.name} image={post.author.image} className="size-14 text-lg" />
              <div>
                <p className="font-bold text-navy">{post.author.name}</p>
                {post.author.bio ? (
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{post.author.bio}</p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">Author at EdX Learning</p>
                )}
              </div>
            </aside>
          )}
        </article>
        <aside>
          <div className="rounded-xl border border-gray-200 bg-white p-5 lg:sticky lg:top-24">
            <div className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-100">
                <BookOpen className="size-4 text-blue-600" />
              </span>
              <h2 className="text-base font-bold text-navy">Recommended Courses</h2>
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

      {related.length > 0 && (
        <section aria-labelledby="related-posts" className="border-t border-gray-100 bg-white py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="related-posts" className="mb-6 text-2xl font-extrabold text-navy">
              Related articles
            </h2>
            <ul className="grid gap-6 md:grid-cols-3">
              {related.map((item) => (
                <li key={item.id}>
                  <article className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                    <div className="relative h-40">
                      <PostImage image={item.image} sizes="(min-width: 768px) 33vw, 100vw" />
                    </div>
                    <div className="p-5">
                      {item.category && (
                        <span className="mb-1 block text-xs font-bold tracking-wider text-blue-600 uppercase">
                          {item.category.name}
                        </span>
                      )}
                      <h3 className="text-base leading-snug font-bold text-navy transition-colors group-hover:text-blue-600">
                        <Link href={`/blog/${item.slug}`} className="after:absolute after:inset-0">
                          {item.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-xs text-gray-500">
                        {formatPostDate(item.date)} · {item.readTime}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
