import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import { BlogSlider } from "@/components/site/blog-slider";
import { PostImage } from "@/components/site/post-image";
import { SectionBadge } from "@/components/site/section-badge";
import { formatPostDate } from "@/lib/blog-post";
import { categoryStyle } from "@/lib/category";
import { firstParam, intParam, type SearchParams } from "@/lib/table-params";
import { cn } from "@/lib/utils";
import { getBlogFilters, getFeaturedPosts, getLatestPosts } from "@/services/blog";

export const metadata: Metadata = {
  title: "Blog",
};

function blogHref(params: { category?: string; tag?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

const pillClass = (active: boolean) =>
  cn(
    "rounded-full border px-4 py-1.5 text-sm font-medium transition",
    active
      ? "border-blue-600 bg-blue-600 text-white"
      : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600",
  );

export default async function BlogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const category = firstParam(params.category) || undefined;
  const tag = firstParam(params.tag) || undefined;
  const filtered = Boolean(category || tag);

  const [filters, latest, featured] = await Promise.all([
    getBlogFilters(),
    getLatestPosts({ category, tag, page: intParam(params.page) }),
    filtered ? Promise.resolve([]) : getFeaturedPosts(),
  ]);
  const pages = Math.max(1, Math.ceil(latest.total / latest.pageSize));
  const activeTag = filters.tags.find((t) => t.slug === tag);
  const showSlider = featured.length > 0 && latest.page === 1;

  return (
    <>
      {showSlider && (
        <BlogSlider
          slides={featured.map(({ slug, title, category: c, excerpt, image }) => ({
            slug,
            title,
            category: c?.name ?? null,
            excerpt,
            image,
          }))}
        />
      )}

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <SectionBadge className="mb-3">All Articles</SectionBadge>
            <h1 className="text-3xl font-extrabold text-navy">
              {activeTag ? `Tagged “${activeTag.name}”` : "Latest From Our Blog"}
            </h1>
          </div>

          {(filters.categories.length > 0 || tag) && (
            <nav aria-label="Filter articles" className="mb-8 flex flex-wrap items-center gap-2">
              <Link href={blogHref({ tag })} className={pillClass(!category)} aria-current={!category ? "page" : undefined}>
                All
              </Link>
              {filters.categories.map((c) => (
                <Link
                  key={c.slug}
                  href={blogHref({ category: c.slug, tag })}
                  className={pillClass(category === c.slug)}
                  aria-current={category === c.slug ? "page" : undefined}
                >
                  {c.name}
                </Link>
              ))}
              {tag && (
                <Link href={blogHref({ category })} className="ml-2 text-sm font-medium text-blue-600 hover:underline">
                  Clear tag
                </Link>
              )}
            </nav>
          )}

          {latest.posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="font-bold text-navy">No articles found</p>
              <p className="mt-1 text-sm text-gray-500">
                {filtered ? "Nothing matches this filter yet." : "New articles will appear here soon."}
              </p>
              {filtered && (
                <Link href="/blog" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline">
                  Show all articles
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {latest.posts.map((post) => (
                <article
                  key={post.slug}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] sm:flex-row"
                >
                  <div className="flex flex-1 flex-col justify-center p-6">
                    {post.category && (
                      <span
                        className={cn(
                          "mb-2 text-xs font-bold tracking-wider uppercase",
                          categoryStyle(post.category.name).text,
                        )}
                      >
                        {post.category.name}
                      </span>
                    )}
                    <h2 className="mb-3 text-lg leading-snug font-bold text-navy transition-colors group-hover:text-blue-600">
                      <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                        {post.title}
                      </Link>
                    </h2>
                    <p className="mb-4 text-sm leading-relaxed text-gray-600">{post.excerpt}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {post.readTime}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {formatPostDate(post.date)}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-48 shrink-0 sm:h-auto sm:w-72">
                    <PostImage image={post.image} sizes="(min-width: 640px) 18rem, 100vw" />
                  </div>
                </article>
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {latest.page > 1 && (
                <Link href={blogHref({ category, tag, page: latest.page - 1 })} className={pillClass(false)}>
                  Previous
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={blogHref({ category, tag, page: n })}
                  className={pillClass(n === latest.page)}
                  aria-current={n === latest.page ? "page" : undefined}
                >
                  {n}
                </Link>
              ))}
              {latest.page < pages && (
                <Link href={blogHref({ category, tag, page: latest.page + 1 })} className={pillClass(false)}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
