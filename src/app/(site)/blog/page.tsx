import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import { BlogSlider } from "@/components/site/blog-slider";
import { SectionBadge } from "@/components/site/section-badge";
import { categoryStyle } from "@/lib/category";
import { unsplash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFeaturedPosts, getLatestPosts } from "@/services/blog";

export const metadata: Metadata = {
  title: "Blog",
};

export default async function BlogPage() {
  const [featured, latest] = await Promise.all([
    getFeaturedPosts(),
    getLatestPosts(),
  ]);

  return (
    <>
      <BlogSlider
        slides={featured.map(({ slug, title, category, excerpt, image }) => ({
          slug,
          title,
          category,
          excerpt,
          image,
        }))}
      />

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <SectionBadge className="mb-3">All Articles</SectionBadge>
            <h1 className="text-3xl font-extrabold text-navy">
              Latest From Our Blog
            </h1>
          </div>
          <div className="space-y-5">
            {latest.map((post) => (
              <article
                key={post.slug}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] sm:flex-row"
              >
                <div className="flex flex-1 flex-col justify-center p-6">
                  <span
                    className={cn(
                      "mb-2 text-xs font-bold tracking-wider uppercase",
                      categoryStyle(post.category).text,
                    )}
                  >
                    {post.category}
                  </span>
                  <h2 className="mb-3 text-lg leading-snug font-bold text-navy transition-colors group-hover:text-blue-600">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="after:absolute after:inset-0"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mb-4 text-sm leading-relaxed text-gray-600">
                    {post.excerpt}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {post.readTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      Last updated: {post.publishedAt}
                    </span>
                  </div>
                </div>
                <div className="relative h-48 shrink-0 sm:h-auto sm:w-72">
                  <Image
                    src={unsplash(post.image, 600)}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 18rem, 100vw"
                    className="object-cover"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
