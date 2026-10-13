// Student, instructor and admin drive panel routing and the superuser check,
// so they are system roles: viewable, but never edited, renamed or deleted.
export const SYSTEM_ROLES = ["student", "instructor", "admin"] as const;

export function isSystemRole(name: string) {
  return (SYSTEM_ROLES as readonly string[]).includes(name);
}
