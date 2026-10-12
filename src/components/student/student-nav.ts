import {
  Award,
  Bell,
  BookOpen,
  Gift,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  UserRound,
} from "lucide-react";

export type StudentNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const studentNav: StudentNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Courses", href: "/my-courses", icon: BookOpen },
  { label: "My Certificates", href: "/my-certificates", icon: Award },
  { label: "My Offers", href: "/my-offers", icon: Gift },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];
