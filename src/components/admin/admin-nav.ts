import {
  ArrowRightLeft,
  Award,
  BookOpen,
  Bot,
  ChartLine,
  ChartPie,
  CirclePlus,
  ClipboardList,
  Coins,
  FileCode,
  FilePen,
  FileText,
  GraduationCap,
  History,
  Images,
  Layers,
  LayoutDashboard,
  Link,
  type LucideIcon,
  Megaphone,
  MousePointerClick,
  Network,
  Newspaper,
  ReceiptText,
  Search,
  SearchX,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Tags,
  Ticket,
  TrendingUp,
  UserCheck,
  UserCog,
  UserPen,
  Users,
} from "lucide-react";
import { createElement, type ReactNode } from "react";
import type { PermissionKey } from "@/lib/permissions";
import { can, type CurrentUser } from "@/services/user";

export type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  // Items without an href are shown disabled until their module is built.
  href?: string;
  // Hidden from users who lack it (admin passes every check).
  permission?: PermissionKey;
};

// A heading with children; a bare item (no `items`) is a top-level link.
export type AdminNavGroup = {
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const adminNav: AdminNavEntry[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin", permission: "dashboard.view" },
  {
    label: "Courses",
    icon: BookOpen,
    items: [
      { label: "All Courses", icon: BookOpen, href: "/admin/courses", permission: "course.view" },
      { label: "Add Course", icon: CirclePlus, href: "/admin/courses/new", permission: "course.create" },
      { label: "Categories", icon: Tags, href: "/admin/courses/categories", permission: "course.view" },
      { label: "Tags", icon: Tag, href: "/admin/courses/tags", permission: "course.view" },
      { label: "Reviews", icon: Star, href: "/admin/reviews", permission: "review.moderate" },
    ],
  },
  {
    label: "Learners",
    icon: GraduationCap,
    items: [
      { label: "All Learners", icon: Users, href: "/admin/learners", permission: "enrolment.view" },
      { label: "Enrolments", icon: UserCheck, href: "/admin/enrolments", permission: "enrolment.view" },
      { label: "Certificates", icon: Award, href: "/admin/certificates", permission: "certificate.view" },
      { label: "Activity", icon: History },
    ],
  },
  {
    label: "Commerce",
    icon: ShoppingCart,
    items: [
      { label: "Orders", icon: ShoppingCart, href: "/admin/orders", permission: "order.view" },
      { label: "Coupons", icon: Ticket, href: "/admin/coupons", permission: "coupon.view" },
    ],
  },
  {
    label: "Forms",
    icon: ClipboardList,
    items: [
      { label: "All Forms", icon: ClipboardList },
      { label: "Create Form", icon: CirclePlus },
      { label: "Entries", icon: FilePen },
      { label: "Form Analytics", icon: ChartPie },
    ],
  },
  {
    label: "Analytics",
    icon: ChartLine,
    items: [
      { label: "Overview", icon: ChartLine },
      { label: "Traffic", icon: TrendingUp },
      { label: "Sales", icon: Coins },
      { label: "Courses", icon: BookOpen },
      { label: "Learners", icon: Users },
      { label: "Marketing", icon: Megaphone },
      { label: "Reports", icon: ReceiptText },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { label: "Tracking & Pixels", icon: ChartPie },
      { label: "UTM Attribution", icon: Link },
      { label: "Conversion Events", icon: MousePointerClick },
      { label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    label: "SEO",
    icon: Search,
    items: [
      { label: "Dashboard", icon: Search },
      { label: "Pages", icon: Layers },
      { label: "Courses", icon: BookOpen },
      { label: "Blog", icon: Newspaper },
      { label: "Schema", icon: FileCode },
      { label: "Sitemap", icon: Network },
      { label: "Redirects", icon: ArrowRightLeft },
      { label: "404 Monitor", icon: SearchX },
      { label: "Search Console", icon: Bot },
    ],
  },
  {
    label: "Blog",
    icon: Newspaper,
    items: [
      { label: "Posts", icon: FileText, href: "/admin/blog", permission: "post.view" },
      { label: "Categories", icon: Tags, href: "/admin/blog/categories", permission: "post.view" },
      { label: "Tags", icon: Tag, href: "/admin/blog/tags", permission: "post.view" },
      { label: "Authors", icon: UserPen, href: "/admin/blog/authors", permission: "post.view" },
    ],
  },
  { label: "Media", icon: Images, href: "/admin/media", permission: "media.view" },
  {
    label: "Employees & Roles",
    icon: UserCog,
    items: [
      { label: "Employees", icon: Users, href: "/admin/employees", permission: "user.view" },
      { label: "Roles", icon: Shield, href: "/admin/roles", permission: "role.view" },
    ],
  },
  { label: "Settings", icon: Settings, href: "/admin/settings", permission: "settings.manage" },
  { label: "Activity Logs", icon: History, href: "/admin/activity-logs", permission: "activity.view" },
];

export const instructorNav: AdminNavEntry[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/instructor" },
  { label: "My Courses", icon: BookOpen, href: "/instructor/courses", permission: "course.view" },
  { label: "Add Course", icon: CirclePlus, href: "/instructor/courses/new", permission: "course.create" },
];

// What the client sidebar receives: only permitted entries, icons already
// rendered, so nothing the user may not see is shipped to the browser.
export type AdminNavLinkView = { label: string; icon: ReactNode; href?: string };
export type AdminNavGroupView = {
  label: string;
  icon: ReactNode;
  items: AdminNavLinkView[];
};
export type AdminNavView = (AdminNavLinkView | AdminNavGroupView)[];

function isGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return "items" in entry;
}

function render(Icon: LucideIcon) {
  return createElement(Icon);
}

export function buildAdminNav(user: CurrentUser): AdminNavView {
  return buildNav(adminNav, user);
}

export function buildInstructorNav(user: CurrentUser): AdminNavView {
  return buildNav(instructorNav, user);
}

function buildNav(entries: AdminNavEntry[], user: CurrentUser): AdminNavView {
  const allowed = (item: AdminNavItem) =>
    !item.permission || can(user, item.permission);
  const toLink = (item: AdminNavItem): AdminNavLinkView => ({
    label: item.label,
    icon: render(item.icon),
    href: item.href,
  });

  const view: AdminNavView = [];
  for (const entry of entries) {
    if (!isGroup(entry)) {
      if (allowed(entry)) view.push(toLink(entry));
      continue;
    }
    const items = entry.items.filter(allowed).map(toLink);
    if (items.length > 0) {
      view.push({ label: entry.label, icon: render(entry.icon), items });
    }
  }
  return view;
}
