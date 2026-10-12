import {
  ArrowRightLeft,
  Award,
  BookOpen,
  Bot,
  Box,
  ChartColumn,
  ChartLine,
  ChartPie,
  CirclePlus,
  CircleQuestionMark,
  ClipboardList,
  Coins,
  FileCode,
  FilePen,
  FileText,
  Globe,
  GraduationCap,
  History,
  Images,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Link,
  type LucideIcon,
  Megaphone,
  Menu,
  MousePointerClick,
  Network,
  Newspaper,
  PanelTop,
  Paintbrush,
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
  Undo2,
  UserCheck,
  UserCog,
  UserPen,
  Users,
  Wallet,
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
    label: "Website",
    icon: Globe,
    items: [
      { label: "Pages", icon: Layers },
      { label: "Templates", icon: LayoutTemplate },
      { label: "Navigation", icon: Menu },
      { label: "Header & Footer", icon: PanelTop },
      { label: "Website Builder", icon: Paintbrush },
    ],
  },
  {
    label: "Courses",
    icon: BookOpen,
    items: [
      { label: "All Courses", icon: BookOpen },
      { label: "Add Course", icon: CirclePlus },
      { label: "Categories", icon: Tags },
      { label: "Tags", icon: Tag },
      { label: "Modules", icon: Box },
      { label: "Lessons", icon: FileText },
      { label: "Quizzes", icon: CircleQuestionMark },
      { label: "Certificates", icon: Award },
      { label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Learners",
    icon: GraduationCap,
    items: [
      { label: "All Learners", icon: Users },
      { label: "Enrolments", icon: UserCheck },
      { label: "Progress", icon: ChartColumn },
      { label: "Certificates", icon: Award },
      { label: "Activity", icon: History },
    ],
  },
  {
    label: "Commerce",
    icon: ShoppingCart,
    items: [
      { label: "Orders", icon: ShoppingCart },
      { label: "Products", icon: Box },
      { label: "Bundles", icon: Layers },
      { label: "Coupons", icon: Ticket },
      { label: "Transactions", icon: Wallet },
      { label: "Refunds", icon: Undo2 },
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
      { label: "Posts", icon: FileText },
      { label: "Categories", icon: Tags },
      { label: "Tags", icon: Tag },
      { label: "Authors", icon: UserPen },
    ],
  },
  { label: "Media", icon: Images },
  {
    label: "Users",
    icon: UserCog,
    items: [
      { label: "Users", icon: Users, href: "/admin/users", permission: "user.view" },
      { label: "Roles & Permissions", icon: Shield, href: "/admin/users/roles", permission: "role.view" },
    ],
  },
  { label: "Settings", icon: Settings },
  { label: "Activity Logs", icon: History, href: "/admin/activity-logs", permission: "activity.view" },
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
  const allowed = (item: AdminNavItem) =>
    !item.permission || can(user, item.permission);
  const toLink = (item: AdminNavItem): AdminNavLinkView => ({
    label: item.label,
    icon: render(item.icon),
    href: item.href,
  });

  const view: AdminNavView = [];
  for (const entry of adminNav) {
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
