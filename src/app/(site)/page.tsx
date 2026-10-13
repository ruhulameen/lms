import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  CircleDollarSign,
  Clock,
  LifeBuoy,
  MonitorPlay,
  Search,
  ShieldCheck,
} from "lucide-react";
import { CourseCard } from "@/components/site/course-card";
import { SectionBadge } from "@/components/site/section-badge";
import { unsplash } from "@/lib/format";
import { getFeaturedCourses } from "@/services/course";
import { getTestimonials } from "@/services/review";
import { getSettings } from "@/lib/settings-store";

export function generateMetadata(): Metadata {
  const { name, tagline } = getSettings().site;
  return { title: { absolute: tagline ? `${name} - ${tagline}` : name } };
}

const heroPoints = [
  { icon: ShieldCheck, label: "100% Online Learning" },
  { icon: BadgeCheck, label: "CPD Accredited Courses" },
  { icon: Clock, label: "Flexible Study Options" },
  { icon: MonitorPlay, label: "Lifetime Access" },
];

const features = [
  { icon: BookOpen, title: "Expert-Led Training", text: "Learn from industry professionals" },
  { icon: ShieldCheck, title: "Recognised Certificates", text: "Boost your career prospects" },
  { icon: Clock, title: "Lifetime Access", text: "Study at your own pace" },
  { icon: LifeBuoy, title: "24/7 Support", text: "We're here to help" },
];

const reasons = [
  { icon: Clock, title: "Flexible Learning", text: "Study at your own pace, anywhere." },
  { icon: CircleDollarSign, title: "Affordable Prices", text: "Great value with regular discounts." },
  { icon: ShieldCheck, title: "Industry Recognised", text: "Gain qualifications that employers trust." },
  { icon: LifeBuoy, title: "Dedicated Support", text: "Our friendly team is here to help." },
];

const partners = ["CPD", "NCFE", "CIPD", "Ofqual", "edexcel"];

const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

export default async function HomePage() {
  const [courses, testimonials] = await Promise.all([
    getFeaturedCourses(),
    getTestimonials(),
  ]);

  return (
    <>
      <section className="relative overflow-hidden bg-linear-to-br from-[#f0f7ff] to-[#e0f2fe] pt-12 pb-16">
        <div className={`${container} grid items-center gap-12 lg:grid-cols-2`}>
          <div>
            <SectionBadge className="mb-5">
              UK&apos;s Leading Online Learning Platform
            </SectionBadge>
            <h1 className="mb-5 text-4xl leading-tight font-extrabold text-navy lg:text-5xl">
              Get Trained &amp; Certified <br className="hidden sm:block" />
              With <span className="text-blue-600">{getSettings().site.name}</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-gray-600">
              Flexible, affordable and industry-recognised courses to help you
              build new skills, advance your career and achieve your goals.
            </p>
            <form
              action="/courses"
              className="mb-8 flex max-w-xl flex-col gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm sm:flex-row"
            >
              <label className="flex flex-1 items-center px-3">
                <Search className="mr-2 size-5 text-gray-400" />
                <span className="sr-only">Search for courses</span>
                <input
                  type="search"
                  name="q"
                  placeholder="Search for courses..."
                  className="w-full py-3 text-sm text-gray-700 outline-none"
                />
              </label>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-blue-700"
              >
                Browse Courses <ArrowRight className="size-4" />
              </button>
            </form>
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600">
              {heroPoints.map((point) => (
                <li key={point.label} className="flex items-center gap-2">
                  <point.icon className="size-5 text-blue-600" />
                  {point.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative hidden lg:block">
            <Image
              src={unsplash("photo-1571260899304-425eee4c7efc", 800)}
              alt="Student learning online"
              width={800}
              height={500}
              preload
              className="h-[500px] w-full rounded-2xl object-cover shadow-xl"
            />
            <div className="absolute -top-6 -right-6 flex items-center gap-3 rounded-xl bg-white p-4 shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check className="size-6" />
              </span>
              <div>
                <p className="text-xs text-gray-500">Certified</p>
                <p className="text-sm font-bold text-navy">Course Completed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${container} relative z-10 -mt-6`}>
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-blue-100 bg-[#eaf2ff] p-6 md:flex-row md:p-8">
          <div className="flex items-center gap-4">
            <p className="-rotate-6 text-3xl leading-none font-extrabold text-navy sm:text-4xl">
              BACK TO
              <br />
              <span className="text-blue-600">SCHOOL</span>
            </p>
            <div>
              <p className="text-xl font-bold text-navy">
                Get Up To <span className="text-2xl text-blue-600">40% OFF</span>
              </p>
              <p className="text-sm text-gray-600">On All Courses</p>
            </div>
          </div>
          <Link
            href="/hot-deals"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 font-bold whitespace-nowrap text-white shadow-md transition hover:bg-blue-700"
          >
            Shop Now <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="py-12">
        <div className={`${container} grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4`}>
          {features.map((feature) => (
            <div key={feature.title} className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <feature.icon className="size-6" />
              </span>
              <div>
                <p className="text-sm font-bold text-navy">{feature.title}</p>
                <p className="text-xs text-gray-500">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className={container}>
          <div className="mb-10 flex flex-col items-start justify-between sm:flex-row sm:items-end">
            <div>
              <SectionBadge className="mb-3">Popular Courses</SectionBadge>
              <h2 className="text-3xl font-extrabold text-navy">
                Find The Best Courses For You
              </h2>
            </div>
            <Link
              href="/courses"
              className="mt-4 flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline sm:mt-0"
            >
              View All Courses <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className={container}>
          <div className="flex flex-col items-center justify-between gap-8 border-y border-gray-100 py-8 md:flex-row">
            <div className="text-center md:text-left">
              <p className="mb-1 text-xs font-bold tracking-wider text-blue-600 uppercase">
                Trusted by Thousands
              </p>
              <h3 className="text-xl font-bold text-navy">
                Our Partners &amp; Accreditations
              </h3>
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {partners.map((partner) => (
                <li key={partner} className="text-xl font-bold text-gray-400">
                  {partner}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className={`${container} flex flex-col items-center gap-12 lg:flex-row`}>
          <div className="lg:w-1/3">
            <h2 className="mb-4 text-3xl font-extrabold text-navy">
              Why Choose {getSettings().site.name}?
            </h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We&apos;re committed to providing high-quality, flexible and
              affordable learning opportunities for everyone.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:w-2/3 lg:grid-cols-4">
            {reasons.map((reason) => (
              <div
                key={reason.title}
                className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm"
              >
                <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <reason.icon className="size-6" />
                </span>
                <h4 className="mb-2 text-sm font-bold text-navy">
                  {reason.title}
                </h4>
                <p className="text-xs text-gray-500">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className={container}>
          <div className="mb-10">
            <SectionBadge className="mb-3">What Our Learners Say</SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">
              Real People. Real Success.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="flex flex-col rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
              >
                <figcaption className="mb-4 flex items-center gap-4">
                  <Image
                    src={testimonial.avatar}
                    alt=""
                    width={48}
                    height={48}
                    className="size-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-bold text-navy">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-gray-500">{testimonial.course}</p>
                  </div>
                </figcaption>
                <p className="mb-3 text-sm text-amber-500">★★★★★</p>
                <blockquote className="text-sm leading-relaxed text-gray-600 italic">
                  “{testimonial.quote}”
                </blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
