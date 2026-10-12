import "server-only";
import { forbidden, notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions";
import { FORBIDDEN_MESSAGE, authorizeAction, can, requireUser, type CurrentUser } from "@/services/user";

// Who may change a course. Permissions say what kind of work a role does;
// ownership says whose courses. Full access with `course.publish` (and the
// admin superuser); anyone else with the permission only works on courses they
// teach or created. Call it after checking the permission itself.

export type CourseOwnership = { instructorId: number | null; createdById: number | null };

export function canManageCourse(user: CurrentUser, course: CourseOwnership) {
  if (can(user, "course.publish")) return true;
  return course.instructorId === user.id || course.createdById === user.id;
}

async function loadOwnership(courseId: number) {
  return db.course.findUnique({ where: { id: courseId }, select: { id: true, instructorId: true, createdById: true } });
}

// Pages and services: requires `permission` (default course.edit) and ownership.
// Unknown course is a 404, someone else's course a 403.
export async function assertCourseAccess(courseId: number, permission: PermissionKey = "course.edit") {
  const user = await requireUser();
  if (!can(user, permission)) forbidden();
  const course = await loadOwnership(courseId);
  if (!course) notFound();
  if (!canManageCourse(user, course)) forbidden();
  return { user, course };
}

// Server actions: the same check, handing failures back as a result.
export async function authorizeCourseAction(courseId: number, permission: PermissionKey = "course.edit") {
  const authz = await authorizeAction(permission);
  if (!authz.ok) return authz;
  const course = await loadOwnership(courseId);
  if (!course) return { ok: false as const, result: { ok: false as const, error: "This course no longer exists." } };
  if (!canManageCourse(authz.user, course)) {
    return { ok: false as const, result: { ok: false as const, error: FORBIDDEN_MESSAGE } };
  }
  return { ok: true as const, user: authz.user, course };
}

// For lists: a Prisma `where` limiting a course query to what the user may manage.
export function manageableCoursesWhere(user: CurrentUser) {
  if (can(user, "course.publish")) return {};
  return { OR: [{ instructorId: user.id }, { createdById: user.id }] };
}
