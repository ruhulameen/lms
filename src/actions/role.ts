"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { allPermissions } from "@/lib/permissions";
import { isSystemRole } from "@/lib/roles";
import { logActivity } from "@/services/activity";
import { authorizeAction } from "@/services/user";

const NAME_TAKEN = "A role with this name already exists.";

const knownKeys = new Set<string>(allPermissions.map((p) => p.key));

// Shared by create and update. `permissions` is every ticked checkbox.
const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(40, "Use at most 40 characters.")
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens, e.g. content-editor."),
  description: z.string().trim().max(200, "Use at most 200 characters.").optional(),
  permissions: z.array(z.string()).transform((keys) => [...new Set(keys.filter((k) => knownKeys.has(k)))].sort()),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

function parseRoleForm(formData: FormData) {
  return roleSchema.extend(idSchema.partial().shape).safeParse({
    ...Object.fromEntries(formData),
    permissions: formData.getAll("permissions").filter((v) => typeof v === "string"),
  });
}

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

async function permissionIds(keys: string[]) {
  const rows = await db.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function createRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("role.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = parseRoleForm(formData);
  if (!parsed.success) return invalid(parsed.error, formData);
  const { name, description, permissions } = parsed.data;
  if (isSystemRole(name)) {
    const message = `"${name}" is a system role name. Choose another name.`;
    return { ok: false, error: message, fieldErrors: { name: [message] }, values: formValues(formData) };
  }

  const ids = await permissionIds(permissions);
  let id: number;
  try {
    ({ id } = await db.role.create({
      data: {
        name,
        description: description || null,
        permissions: { create: ids.map((permissionId) => ({ permissionId })) },
      },
      select: { id: true },
    }));
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken(formData);
    throw error;
  }

  await logActivity({ userId: authz.user.id, action: "role.create", entity: "role", entityId: id, details: { name } });
  if (permissions.length > 0) {
    await logActivity({
      userId: authz.user.id,
      action: "role.permissions-update",
      entity: "role",
      entityId: id,
      details: { role: name, added: permissions, removed: [] },
    });
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/roles/${id}?created=1`);
}

export async function updateRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("role.manage");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = parseRoleForm(formData);
  if (!parsed.success) return invalid(parsed.error, formData);
  const { id, name, description, permissions } = parsed.data;
  if (!id) return { ok: false, error: "Invalid request.", values: formValues(formData) };

  const role = await db.role.findUnique({
    where: { id },
    select: { name: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  if (!role) return { ok: false, error: "This role no longer exists.", values: formValues(formData) };
  if (isSystemRole(role.name)) {
    return { ok: false, error: `"${role.name}" is a system role and cannot be changed.`, values: formValues(formData) };
  }
  if (isSystemRole(name)) {
    const message = `"${name}" is a system role name. Choose another name.`;
    return { ok: false, error: message, fieldErrors: { name: [message] }, values: formValues(formData) };
  }

  const current = new Set(role.permissions.map((p) => p.permission.key));
  const next = new Set(permissions);
  const added = permissions.filter((k) => !current.has(k));
  const removed = [...current].filter((k) => !next.has(k)).sort();
  const ids = await permissionIds(permissions);

  try {
    await db.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { name, description: description || null } });
      if (added.length > 0 || removed.length > 0) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: id, permissionId })) });
      }
    });
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
  if (added.length > 0 || removed.length > 0) {
    await logActivity({
      userId: authz.user.id,
      action: "role.permissions-update",
      entity: "role",
      entityId: id,
      details: { role: name, added, removed },
    });
  }
  // Permissions feed every signed-in user's menu and checks.
  revalidatePath("/admin", "layout");
  redirect(`/admin/roles/${id}?saved=1`);
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
  if (isSystemRole(role.name)) {
    return { ok: false, error: `"${role.name}" is a system role and cannot be deleted.` };
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
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Role "${role.name}" deleted.` };
}
