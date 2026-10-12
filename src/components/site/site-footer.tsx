import Link from "next/link";
import { BookOpen } from "lucide-react";

const columns = [
  {
    title: "Quick Links",
    links: [
      { label: "Home", href: "/" },
      { label: "Courses", href: "/courses" },
      { label: "About Us", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Help & Support", href: "/contact" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    title: "Categories",
    links: [
      "Health & Social Care",
      "Health & Safety",
      "Business & Management",
      "IT & Computing",
      "Teaching & Education",
      "Construction",
    ].map((label) => ({ label, href: "/courses" })),
  },
  {
    title: "Support",
    links: [
      { label: "FAQs", href: "/about#faqs" },
      { label: "Student Support", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy pt-16 pb-8 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded bg-white">
                <BookOpen className="size-5 text-navy" />
              </span>
              <span className="text-lg font-bold text-white">EdX learning</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">
              EdX Learning is a trusted online learning platform providing
              high-quality, flexible and affordable courses to help you achieve
              your career and personal goals.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="mb-4 text-sm font-semibold tracking-wider text-white uppercase">
                {column.title}
              </h4>
              <ul className="space-y-2.5 text-xs">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-[11px] text-gray-400 sm:text-left">
          <p>© {new Date().getFullYear()} EdX Learning. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
