import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getSettings } from "@/lib/settings-store";

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
  const site = getSettings().site;
  const contact = [site.contactEmail, site.contactPhone, site.address].filter(Boolean);
  return (
    <footer className="mt-auto bg-navy pt-16 pb-8 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded bg-white">
                <BookOpen className="size-5 text-navy" />
              </span>
              <span className="text-lg font-bold text-white">{site.name}</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">{site.description}</p>
            {contact.length > 0 && (
              <address className="mt-4 space-y-1 text-xs text-gray-400 not-italic">
                {site.contactEmail && (
                  <p>
                    <a href={`mailto:${site.contactEmail}`} className="transition hover:text-white">
                      {site.contactEmail}
                    </a>
                  </p>
                )}
                {site.contactPhone && <p>{site.contactPhone}</p>}
                {site.address && <p className="whitespace-pre-line">{site.address}</p>}
              </address>
            )}
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
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          {site.social.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 sm:justify-start">
              {site.social.map((link) => (
                <li key={link.label}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
