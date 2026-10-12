import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { SectionBadge } from "@/components/site/section-badge";

export const metadata: Metadata = {
  title: "Help & Support",
};

const channels = [
  {
    icon: Phone,
    title: "Call Us",
    note: "Mon - Fri, 9:00 AM - 6:00 PM",
    value: "+44 (0) 20 7123 4567",
    href: "tel:+442071234567",
  },
  {
    icon: Mail,
    title: "Email Us",
    note: "We reply within 24 hours",
    value: "support@edxlearning.co.uk",
    href: "mailto:support@edxlearning.co.uk",
  },
  {
    icon: MapPin,
    title: "Visit Us",
    note: "Our head office",
    value: "123 Learning Street, London, UK",
  },
];

const hours = [
  { days: "Monday - Friday", time: "9:00 - 18:00" },
  { days: "Saturday", time: "10:00 - 16:00" },
  { days: "Sunday", time: "Closed" },
];

const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

export default function ContactPage() {
  return (
    <>
      <section className="bg-linear-to-br from-[#f0f7ff] to-[#e0f2fe] pt-16 pb-24">
        <div className={`${container} text-center`}>
          <SectionBadge className="mb-4">Get In Touch</SectionBadge>
          <h1 className="mb-4 text-4xl font-extrabold text-navy lg:text-5xl">
            We&apos;d Love To Hear From You
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Have a question about a course, need technical help, or want to
            partner with us?
          </p>
        </div>
      </section>

      <section className={`${container} relative z-10 -mt-12`}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {channels.map((channel) => (
            <div
              key={channel.title}
              className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(0,0,0,0.08)]"
            >
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <channel.icon className="size-7" />
              </span>
              <h2 className="mb-2 text-lg font-bold text-navy">
                {channel.title}
              </h2>
              <p className="mb-3 text-sm text-gray-500">{channel.note}</p>
              {channel.href ? (
                <a
                  href={channel.href}
                  className="font-semibold break-words text-blue-600 hover:underline"
                >
                  {channel.value}
                </a>
              ) : (
                <p className="font-semibold text-blue-600">{channel.value}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className={`${container} grid grid-cols-1 gap-10 lg:grid-cols-3`}>
          <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-10 lg:col-span-2">
            <h2 className="mb-2 text-2xl font-extrabold text-navy">
              Send Us A Message
            </h2>
            <p className="mb-8 text-sm text-gray-500">
              Fill out the form below and one of our team members will get back
              to you shortly.
            </p>
            <ContactForm />
          </div>
          <aside className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-bold text-navy">Support Hours</h3>
              <ul className="space-y-3 text-sm">
                {hours.map((row) => (
                  <li
                    key={row.days}
                    className="flex justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-gray-600">{row.days}</span>
                    <span className="font-semibold">{row.time}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-3 text-lg font-bold text-navy">
                Looking for quick answers?
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                Check out our FAQs for instant answers.
              </p>
              <Link
                href="/about#faqs"
                className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
              >
                Visit Help Centre <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
