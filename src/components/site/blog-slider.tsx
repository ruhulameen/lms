"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { categoryStyle } from "@/lib/category";
import type { BlogPost } from "@/services/blog";
import { cn } from "@/lib/utils";

type Slide = {
  slug: string;
  title: string;
  category: string | null;
  excerpt: string;
  image: BlogPost["image"];
};

const arrowClassName =
  "absolute top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/40 md:size-12";

export function BlogSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const go = (next: number) =>
    setIndex((next + slides.length) % slides.length);

  // Auto-advance; the timer restarts whenever the slide changes.
  useEffect(() => {
    const timer = setTimeout(
      () => setIndex((current) => (current + 1) % slides.length),
      6000,
    );
    return () => clearTimeout(timer);
  }, [index, slides.length]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured articles"
      className="relative h-[480px] overflow-hidden bg-gray-900 md:h-[560px]"
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.slug}
            aria-hidden={i !== index}
            className="relative h-full w-full shrink-0"
          >
            {slide.image ? (
              <Image
                src={slide.image.url}
                alt=""
                fill
                sizes="100vw"
                preload={i === 0}
                className="object-cover"
              />
            ) : (
              <div aria-hidden className="absolute inset-0 bg-linear-to-br from-navy to-blue-900" />
            )}
            <div className="absolute inset-0 bg-linear-to-r from-navy/90 via-navy/75 to-navy/15" />
            <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-14 sm:px-16 lg:px-8">
              <div className="max-w-2xl">
                {slide.category && (
                  <span
                    className={cn(
                      "mb-5 inline-block rounded-full px-3 py-1.5 text-xs font-bold text-white",
                      categoryStyle(slide.category).solid,
                    )}
                  >
                    {slide.category}
                  </span>
                )}
                <h2 className="mb-5 text-3xl leading-tight font-extrabold text-white md:text-5xl">
                  {slide.title}
                </h2>
                <p className="mb-7 max-w-xl text-base text-blue-100 md:text-lg">
                  {slide.excerpt}
                </p>
                <Link
                  href={`/blog/${slide.slug}`}
                  tabIndex={i === index ? undefined : -1}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 font-bold text-navy shadow-lg transition hover:bg-blue-50"
                >
                  Read Article <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous article"
        onClick={() => go(index - 1)}
        className={cn(arrowClassName, "left-2 md:left-8")}
      >
        <ChevronLeft className="size-6" />
      </button>
      <button
        type="button"
        aria-label="Next article"
        onClick={() => go(index + 1)}
        className={cn(arrowClassName, "right-2 md:right-8")}
      >
        <ChevronRight className="size-6" />
      </button>

      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.slug}
            type="button"
            aria-label={`Show article ${i + 1}`}
            aria-current={i === index}
            onClick={() => go(i)}
            className={cn(
              "h-2.5 rounded-full transition-all duration-300",
              i === index ? "w-7 bg-white" : "w-2.5 bg-white/40",
            )}
          />
        ))}
      </div>
    </section>
  );
}
