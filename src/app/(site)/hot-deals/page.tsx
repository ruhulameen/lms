import type { Metadata } from "next";
import { BadgeCheck, Gift, Tag, Zap } from "lucide-react";
import { CopyCodeButton } from "@/components/site/copy-code-button";
import { DealCard } from "@/components/site/course-card";
import { SectionBadge } from "@/components/site/section-badge";
import { cn } from "@/lib/utils";
import { getDeals, getFreeCourses } from "@/services/course";

export const metadata: Metadata = {
  title: "Hot Deals",
};

const stats = [
  { value: "90%", label: "Off on selected courses", className: "text-yellow-400" },
  { value: "25%", label: "Off all certificates", className: "text-pink-400" },
  { value: "100%", label: "Free courses available", className: "text-green-400" },
  { value: "25%", label: "Off subscriptions", className: "text-cyan-400" },
];

const coupons = [
  {
    amount: "15%",
    title: "15% OFF Sitewide",
    terms: "Valid on all courses. Min spend £20.",
    code: "SAVE15NOW",
    className: "bg-blue-600",
  },
  {
    amount: "20%",
    title: "20% OFF First Order",
    terms: "New customers only. No minimum spend.",
    code: "WELCOME20",
    className: "bg-green-600",
  },
  {
    amount: "£5",
    title: "£5 OFF Any Bundle",
    terms: "Bundle purchase required. Min spend £30.",
    code: "BUNDLE5",
    className: "bg-pink-500",
  },
];

const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const grid = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4";

export default async function HotDealsPage() {
  const [deals90, deals80, freeCourses] = await Promise.all([
    getDeals("90"),
    getDeals("80"),
    getFreeCourses(),
  ]);

  return (
    <>
      <section className="bg-linear-to-br from-navy via-blue-900 to-blue-600 py-16 text-white lg:py-20">
        <div className={`${container} grid items-center gap-10 lg:grid-cols-2`}>
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-xs font-bold">
              <Zap className="size-4 fill-current" /> LIMITED TIME OFFERS
            </span>
            <h1 className="mb-5 text-4xl leading-tight font-extrabold md:text-5xl lg:text-6xl">
              Hot Deals &amp; <br />
              <span className="text-yellow-400">Massive Discounts</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-blue-100">
              Save up to <strong className="text-white">90% OFF</strong> on
              accredited courses. Grab free courses, discount coupons, and
              certificate offers before they&apos;re gone!
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#deals"
                className="rounded-lg bg-white px-8 py-3.5 font-bold text-navy shadow-lg transition hover:bg-blue-50"
              >
                Shop Deals
              </a>
              <a
                href="#coupons"
                className="rounded-lg border-2 border-white/50 px-8 py-3.5 font-bold transition hover:bg-white/10"
              >
                View Coupons
              </a>
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-4 lg:grid">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md odd:translate-y-8"
              >
                <p className={cn("mb-1 text-3xl font-extrabold", stat.className)}>
                  {stat.value}
                </p>
                <p className="text-sm text-blue-100">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-gray-100 bg-white py-10">
        <div className={container}>
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-linear-to-r from-pink-500 to-rose-500 p-6 text-white shadow-xl md:flex-row md:p-8">
            <div className="flex items-center gap-5">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <BadgeCheck className="size-8" />
              </span>
              <div>
                <h2 className="mb-1 text-xl font-extrabold md:text-2xl">
                  25% OFF All Certificates
                </h2>
                <p className="text-sm text-pink-100">
                  Get your accredited certificate at a discounted price on any
                  completed course.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/20 p-3 pl-5 backdrop-blur-sm">
              <div>
                <p className="mb-0.5 text-[10px] tracking-wider text-pink-100 uppercase">
                  Use code
                </p>
                <p className="text-lg font-extrabold tracking-wider">CERT25</p>
              </div>
              <CopyCodeButton
                code="CERT25"
                label="Copy Code"
                className="rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-pink-600 transition hover:bg-pink-50"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="deals" className="scroll-mt-24 bg-gray-50 py-16">
        <div className={container}>
          <div className="mb-10">
            <SectionBadge className="mb-3 bg-red-100 text-red-600">
              <Zap className="size-3.5 fill-current" /> MEGA SAVINGS
            </SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">90% OFF Courses</h2>
            <p className="mt-2 text-sm text-gray-600">
              Our biggest discounts ever — grab them before they&apos;re gone!
            </p>
          </div>
          <div className={grid}>
            {deals90.map((deal) => (
              <DealCard key={deal.slug} course={deal} label="-90%" tone="red" />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className={container}>
          <div className="mb-10">
            <SectionBadge className="mb-3 bg-orange-100 text-orange-600">
              <Zap className="size-3.5 fill-current" /> HOT PICKS
            </SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">80% OFF Courses</h2>
            <p className="mt-2 text-sm text-gray-600">
              Top-rated courses at unbeatable prices!
            </p>
          </div>
          <div className={grid}>
            {deals80.map((deal) => (
              <DealCard
                key={deal.slug}
                course={deal}
                label="-80%"
                tone="orange"
              />
            ))}
          </div>
        </div>
      </section>

      <section id="coupons" className="scroll-mt-24 bg-gray-50 py-16">
        <div className={container}>
          <div className="mb-10 text-center">
            <SectionBadge className="mb-3">
              <Tag className="size-3.5" /> EXCLUSIVE CODES
            </SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">
              Discount Coupons
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              Copy these coupon codes and apply them at checkout for instant
              savings.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {coupons.map((coupon) => (
              <div
                key={coupon.code}
                className="rounded-2xl border-2 border-dashed border-blue-300 bg-linear-to-br from-[#f0f7ff] to-[#e0f2fe] p-6 text-center"
              >
                <span
                  className={cn(
                    "mb-4 inline-flex size-14 items-center justify-center rounded-full text-lg font-extrabold text-white",
                    coupon.className,
                  )}
                >
                  {coupon.amount}
                </span>
                <h3 className="mb-1 text-lg font-bold text-navy">
                  {coupon.title}
                </h3>
                <p className="mb-4 text-xs text-gray-600">{coupon.terms}</p>
                <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3">
                  <span className="font-mono text-sm font-bold tracking-widest text-navy">
                    {coupon.code}
                  </span>
                  <CopyCodeButton
                    code={coupon.code}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className={container}>
          <div className="mb-10">
            <SectionBadge className="mb-3 bg-green-100 text-green-600">
              <Gift className="size-3.5" /> 100% FREE
            </SectionBadge>
            <h2 className="text-3xl font-extrabold text-navy">Free Courses</h2>
            <p className="mt-2 text-sm text-gray-600">
              Start learning for free — no credit card required!
            </p>
          </div>
          <div className={grid}>
            {freeCourses.map((course) => (
              <DealCard
                key={course.slug}
                course={course}
                label="FREE"
                tone="green"
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
