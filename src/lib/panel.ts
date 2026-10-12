export type Panel = "student" | "instructor" | "admin";

const PANEL_HOME: Record<Panel, string> = {
  student: "/dashboard",
  instructor: "/instructor",
  admin: "/admin",
};

// `student` and `instructor` are reserved role names; every other role
// (admin, moderator, designer, ...) belongs to the admin panel.
export function panelForRole(role: string | null): Panel {
  if (role === "instructor") return "instructor";
  if (role === null || role === "student") return "student";
  return "admin";
}

export function panelHome(panel: Panel) {
  return PANEL_HOME[panel];
}
