import {
  ArrowRightLeft,
  Award,
  Bell,
  BookOpen,
  Bot,
  ChartColumn,
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  CirclePlus,
  CircleQuestionMark,
  ClipboardList,
  CreditCard,
  FileCode,
  FilePen,
  FileText,
  History,
  Images,
  Layers,
  LayoutDashboard,
  Link,
  type LucideIcon,
  Megaphone,
  Move,
  Music2,
  Network,
  Package,
  Paintbrush,
  Search,
  Settings,
  ShoppingCart,
  Tags,
  Ticket,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  // Items without an href are shown disabled until their module is built.
  href?: string;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNav: AdminNavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Overview", icon: LayoutDashboard, href: "/admin" },
      { label: "Analytics", icon: ChartLine },
    ],
  },
  {
    label: "Website Builder",
    items: [
      { label: "Pages", icon: Layers },
      { label: "Templates", icon: Paintbrush },
      { label: "Drag & Drop Editor", icon: Move },
    ],
  },
  {
    label: "Courses",
    items: [
      { label: "All Courses", icon: BookOpen },
      { label: "Add New", icon: CirclePlus },
      { label: "Categories", icon: Tags },
      { label: "Modules & Lessons", icon: FileText },
      { label: "Quizzes", icon: CircleQuestionMark },
      { label: "Certificates", icon: Award },
    ],
  },
  {
    label: "Learners",
    items: [
      { label: "All Learners", icon: Users },
      { label: "Enrolments", icon: UserCheck },
      { label: "Progress", icon: ChartColumn },
    ],
  },
  {
    label: "WooCommerce",
    items: [
      { label: "Orders", icon: ShoppingCart },
      { label: "Products", icon: Package },
      { label: "Coupons", icon: Ticket },
      { label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Forms",
    items: [
      { label: "All Forms", icon: ClipboardList },
      { label: "Entries", icon: FilePen },
      { label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Tracking & Pixels", icon: ChartPie },
      { label: "Google Analytics", icon: ChartNoAxesCombined },
      { label: "Meta Pixel", icon: Megaphone },
      { label: "TikTok Pixel", icon: Music2 },
      { label: "UTM Tracking", icon: Link },
    ],
  },
  {
    label: "SEO",
    items: [
      { label: "SEO Dashboard", icon: Search },
      { label: "Schema", icon: FileCode },
      { label: "Sitemap", icon: Network },
      { label: "Robots.txt", icon: Bot },
      { label: "Redirects", icon: ArrowRightLeft },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Media", icon: Images },
      { label: "Users & Roles", icon: UserCog },
      { label: "Settings", icon: Settings },
      { label: "Activity Logs", icon: History },
    ],
  },
];
