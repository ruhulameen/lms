import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Building2, ChevronDown, Star, Users } from "lucide-react";
import { ReviewSlider } from "@/components/site/review-slider";
import { SectionBadge } from "@/components/site/section-badge";
import { unsplash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCourseReviews } from "@/services/review";

export const metadata: Metadata = {
  title: "About Us",
};

const stats = [
  {
    icon: Building2,
    value: "1,000+",
    label: "Companies & Businesses",
    note: "Partnering with us to train their teams",
    className: "bg-blue-50 text-blue-600",
  },
  {
    icon: Star,
    value: "10,000+",
    label: "Trustpilot Reviews",
    note: "★★★★★ 4.8 / 5",
    className: "bg-green-50 text-green-600",
  },
  {
    icon: Star,
    value: "10,000+",
    label: "Google Reviews",
    note: "★★★★★ 4.9 / 5",
    className: "bg-red-50 text-red-500",
  },
];

const faqs = [
  {
    question: "What is EdX Learning and how does it work?",
    answer:
      "EdX Learning is an online learning platform offering accredited courses across healthcare, IT, business, construction, and more. You can browse, purchase, and start learning instantly from any device.",
  },
  {
    question: "Are your courses accredited?",
    answer:
      "Yes. Most of our courses are CPD accredited, and many are also recognised by bodies such as NCFE, CIPD, Ofqual, and Edexcel.",
  },
  {
    question: "How long do I have access to a course?",
    answer:
      "All our courses come with lifetime access. Once you enrol, you can revisit the course materials as many times as you like.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes. We offer a 14-day money-back guarantee on all courses. If you're not satisfied for any reason, contact our support team within 14 days for a full refund.",
  },
  {
    question: "Can businesses enrol multiple employees?",
    answer:
      "Absolutely. We work with over 1,000 companies and businesses across the UK. We offer bulk enrolment, dedicated account managers, and custom training solutions.",
  },
  {
    question: "How do I contact support if I need help?",
    answer:
      "Our friendly support team is happy to help. Reach us by email or phone using the details on our Help & Support page.",
  },
];

const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

export default async function AboutPage() {
  const reviews = await getCourseReviews();

  return (
    <>
      <section className="bg-linear-to-br from-[#f0f7ff] to-[#e0f2fe] py-16 lg:py-20">
        <div className={`${container} grid items-center gap-12 lg:grid-cols-2`}>
          <div>
            <SectionBadge className="mb-5">About EdX Learning</SectionBadge>
            <h1 className="mb-5 text-4xl leading-tight font-extrabold text-navy lg:text-5xl">
              Empowering Careers Through{" "}
              <span className="text-blue-600">Accessible Education</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-gray-600">
              We&apos;re on a mission to make high-quality, industry-recognised
              training accessible to everyone.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/courses"
                className="rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Browse Courses
              </Link>
              <Link
                href="/contact"
                className="rounded-lg border border-blue-600 px-8 py-3.5 font-semibold text-blue-600 transition hover:bg-blue-600 hover:text-white"
              >
                Contact Us
              </Link>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <Image
              src={unsplash("photo-1522202176988-66273c2fd55f", 800)}
              alt="Learners studying together"
              width={800}
              height={420}
              preload
              className="h-[420px] w-full rounded-2xl object-cover shadow-xl"
            />
            <div className="absolute -bottom-6 -left-6 flex items-center gap-3 rounded-xl bg-white p-4 shadow-lg">
              <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Users className="size-6" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-navy">50,000+</p>
                <p className="text-xs text-gray-500">Learners Enrolled</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className={container}>
          <div className="mb-12 text-center">
            <SectionBadge className="mb-3">Trusted Worldwide</SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">
              Trusted By Thousands Of Learners &amp; Businesses
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)]"
              >
                <span
                  className={cn(
                    "mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl",
                    stat.className,
                  )}
                >
                  <stat.icon className="size-8" />
                </span>
                <p className="mb-2 text-4xl font-extrabold text-navy">
                  {stat.value}
                </p>
                <p className="mb-1 text-sm font-semibold text-gray-700">
                  {stat.label}
                </p>
                <p className="text-xs text-gray-500">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className={container}>
            <ReviewSlider reviews={reviews} />
          </div>
        </section>
      )}

      <section id="faqs" className="scroll-mt-24 bg-white py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <SectionBadge className="mb-3">FAQs</SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold text-navy transition hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown className="size-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
