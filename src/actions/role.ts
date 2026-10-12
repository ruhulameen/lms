"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { allPermissions } from "@/lib/permissions";
import { logActivity } from "@/services/activity";
import { getPermissionMatrix, isReservedRole } from "@/services/role";
import { authorizeAction } from "@/services/user";

const NAME_TAKEN = "A role with this name already exists.";

const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(40, "Use at most 40 characters.")
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens, e.g. content-editor."),
  description: z.string().trim().max(200, "Use at most 200 characters.").optional(),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formValues(formData),
  };
}

function nameTaken(formData: FormData): FormState {
  return { ok: false, error: NAME_TAKEN, fieldErrors: { name: [NAME_TAKEN] }, values: formValues(formData) };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("role.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { name, description } = parsed.data;

  let id: number;
  try {
    ({ id } = await db.role.create({
      data: { name, description: description || null },
      select: { id: true },
    }));
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken(formData);
    throw error;
  }

  await logActivity({ userId: authz.user.id, action: "role.create", entity: "role", entityId: id, details: { name } });
  revalidatePath("/admin/users/roles");
  return { ok: true, message: `Role "${name}" created.` };
}

export async function updateRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("role.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = roleSchema.extend(idSchema.shape).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { id, name, description } = parsed.data;

  const role = await db.role.findUnique({ where: { id }, select: { name: true, description: true } });
  if (!role) return { ok: false, error: "This role no longer exists.", values: formValues(formData) };
  if (isReservedRole(role.name) && name !== role.name) {
    const message = `"${role.name}" is a reserved role and cannot be renamed.`;
    return { ok: false, error: message, fieldErrors: { name: [message] }, values: formValues(formData) };
  }

  try {
    await db.role.update({ where: { id }, data: { name, description: description || null } });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken(formData);
    throw error;
  }

  await logActivity({
    userId: authz.user.id,
    action: "role.update",
    entity: "role",
    entityId: id,
    details: { from: role.name, to: name },
  });
  revalidatePath("/admin/users", "layout");
  return { ok: true, message: "Role saved." };
}

// Used with ConfirmDialog: field is `id`.
export async function deleteRole(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("role.manage");
  if (!authz.ok) return authz.result;

  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id } = parsed.data;

  const role = await db.role.findUnique({
    where: { id },
    select: { name: true, _count: { select: { users: true } } },
  });
  if (!role) return { ok: false, error: "This role no longer exists." };
  if (isReservedRole(role.name)) {
    return { ok: false, error: `"${role.name}" is a reserved role and cannot be deleted.` };
  }
  if (role._count.users > 0) {
    const n = role._count.users;
    return {
      ok: false,
      error: `${n} ${n === 1 ? "user still has" : "users still have"} this role. Move them to another role first.`,
    };
  }

  try {
    await db.role.delete({ where: { id } });
  } catch (error) {
    // A user was given the role between the check and the delete.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: "Users were just added to this role, so it was not deleted." };
    }
    throw error;
  }

  await logActivity({ userId: authz.user.id, action: "role.delete", entity: "role", entityId: id, details: { name: role.name } });
  revalidatePath("/admin/users", "layout");
  return { ok: true, message: `Role "${role.name}" deleted.` };
}

// Checkbox values are `<roleId>:<permission key>`; the submitted set replaces
// each role's permissions. The admin role is the superuser and is never edited.
export async function savePermissions(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("role.manage");
  if (!authz.ok) return authz.result;

  const known = new Set<string>(allPermissions.map((p) => p.key));
  const matrixRoles = (await getPermissionMatrix()).filter((r) => r.name !== "admin");
  const desired = new Map<number, Set<string>>(matrixRoles.map((r) => [r.id, new Set()]));

  for (const value of formData.getAll("permissions")) {
    if (typeof value !== "string") continue;
    const [roleId, key] = value.split(":");
    const keys = desired.get(Number(roleId));
    if (keys && known.has(key)) keys.add(key);
  }

  const permissionRows = await db.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  const changes = await db.$transaction(async (tx) => {
    const logged: { roleId: number; name: string; added: string[]; removed: string[] }[] = [];
    for (const role of matrixRoles) {
      const next = desired.get(role.id)!;
      const current = new Set<string>(role.keys);
      const added = [...next].filter((k) => !current.has(k)).sort();
      const removed = [...current].filter((k) => !next.has(k)).sort();
      if (added.length === 0 && removed.length === 0) continue;

      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: [...next].flatMap((key) => {
          const permissionId = idByKey.get(key);
          return permissionId ? [{ roleId: role.id, permissionId }] : [];
        }),
      });
      logged.push({ roleId: role.id, name: role.name, added, removed });
    }
    return logged;
  });

  for (const change of changes) {
    await logActivity({
      userId: authz.user.id,
      action: "role.permissions-update",
      entity: "role",
      entityId: change.roleId,
      details: { role: change.name, added: change.added, removed: change.removed },
    });
  }
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: changes.length > 0 ? "Permissions saved." : "No changes to save.",
  };
}
