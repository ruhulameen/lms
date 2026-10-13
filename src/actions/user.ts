"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { Prisma, type UserStatus } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { logActivity } from "@/services/activity";
import { authorizeAction } from "@/services/user";

const SUPERUSER_ROLE = "admin";
const EMAIL_TAKEN = "Another user already has this email address.";

const baseSchema = z.object({
  name: z.string().trim().min(2, "Enter a name of at least 2 characters.").max(100),
  email: z.string().trim().toLowerCase().max(191, "Use at most 191 characters.").pipe(z.email("Enter a valid email address.")),
  roleId: z.coerce.number().int().positive("Choose a role."),
});

const createSchema = baseSchema.extend({
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use at most 128 characters."),
});

const updateSchema = baseSchema.extend({
  id: z.coerce.number().int().positive(),
});

const statusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
});

function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formValues(formData),
  };
}

function fieldError(field: string, message: string, formData: FormData): FormState {
  return { ok: false, error: message, fieldErrors: { [field]: [message] }, values: formValues(formData) };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("user.create");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { name, email, roleId, password } = parsed.data;

  const role = await db.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } });
  if (!role) return fieldError("roleId", "That role no longer exists.", formData);
  if (role.name === SUPERUSER_ROLE && authz.user.role !== SUPERUSER_ROLE) {
    return fieldError("roleId", "Only an administrator can create another administrator.", formData);
  }
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return fieldError("email", EMAIL_TAKEN, formData);
  }

  // Not auth.api.signUpEmail: it would also sign the new user in on this
  // browser. Better Auth's own hasher keeps the stored hash compatible.
  const hash = await hashPassword(password);
  let userId: number;
  try {
    userId = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, roleId: role.id, emailVerified: true },
        select: { id: true },
      });
      await tx.account.create({
        data: { userId: user.id, accountId: String(user.id), providerId: "credential", password: hash },
      });
      return user.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fieldError("email", EMAIL_TAKEN, formData);
    throw error;
  }

  await logActivity({
    userId: authz.user.id,
    action: "user.create",
    entity: "user",
    entityId: userId,
    details: { email, role: role.name },
  });
  revalidatePath("/admin/employees");
  revalidatePath("/admin/learners");
  redirect(`/admin/${role.name === "student" ? "learners" : "employees"}/${userId}?created=1`);
}

export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("user.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { id, name, email, roleId } = parsed.data;
  const actor = authz.user;

  const [target, newRole] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: { name: true, email: true, roleId: true, status: true, role: { select: { name: true } } },
    }),
    db.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } }),
  ]);
  if (!target) return { ok: false, error: "This user no longer exists.", values: formValues(formData) };
  if (!newRole) return fieldError("roleId", "That role no longer exists.", formData);

  const roleChanged = target.roleId !== newRole.id;
  const oldRoleName = target.role?.name ?? null;
  if (roleChanged) {
    if (id === actor.id) return fieldError("roleId", "You cannot change your own role.", formData);
    // Granting or removing admin is itself a superuser-level act.
    if (
      (newRole.name === SUPERUSER_ROLE || oldRoleName === SUPERUSER_ROLE) &&
      actor.role !== SUPERUSER_ROLE
    ) {
      return fieldError("roleId", "Only an administrator can grant or remove the admin role.", formData);
    }
  }

  try {
    const result = await db.$transaction(async (tx) => {
      if (roleChanged && oldRoleName === SUPERUSER_ROLE && target.status === "ACTIVE") {
        const others = await tx.user.count({
          where: { id: { not: id }, status: "ACTIVE", role: { name: SUPERUSER_ROLE } },
        });
        if (others === 0) return "last-admin" as const;
      }
      await tx.user.update({ where: { id }, data: { name, email, roleId: newRole.id } });
      return "ok" as const;
    });
    if (result === "last-admin") {
      return fieldError("roleId", "This is the last active admin, so its role cannot be changed.", formData);
    }
  } catch (error) {
    if (isUniqueViolation(error)) return fieldError("email", EMAIL_TAKEN, formData);
    throw error;
  }

  const changed: string[] = [];
  if (target.name !== name) changed.push("name");
  if (target.email !== email) changed.push("email");
  if (changed.length > 0) {
    await logActivity({
      userId: actor.id,
      action: "user.update",
      entity: "user",
      entityId: id,
      details: { fields: changed },
    });
  }
  if (roleChanged) {
    await logActivity({
      userId: actor.id,
      action: "user.role-change",
      entity: "user",
      entityId: id,
      details: { from: oldRoleName, to: newRole.name },
    });
  }
  revalidatePath("/admin/employees", "layout");
  revalidatePath("/admin/learners", "layout");
  return {
    ok: true,
    message: changed.length > 0 || roleChanged ? "User saved." : "Nothing to change.",
  };
}

const statusActions: Record<UserStatus, { action: string; message: string }> = {
  ACTIVE: { action: "user.reactivate", message: "User reactivated." },
  SUSPENDED: { action: "user.suspend", message: "User suspended and signed out." },
  BANNED: { action: "user.ban", message: "User banned and signed out." },
};

// Used with ConfirmDialog: fields are `id` and `status`.
export async function setUserStatus(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("user.status");
  if (!authz.ok) return authz.result;

  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id, status } = parsed.data;

  if (id === authz.user.id) return { ok: false, error: "You cannot change your own status." };

  const outcome = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { status: true, role: { select: { name: true } } },
    });
    if (!target) return "missing" as const;
    if (target.status === status) return "same" as const;
    if (target.role?.name === SUPERUSER_ROLE && target.status === "ACTIVE" && status !== "ACTIVE") {
      const others = await tx.user.count({
        where: { id: { not: id }, status: "ACTIVE", role: { name: SUPERUSER_ROLE } },
      });
      if (others === 0) return "last-admin" as const;
    }
    await tx.user.update({ where: { id }, data: { status } });
    // Signs the user out everywhere immediately.
    if (status !== "ACTIVE") await tx.session.deleteMany({ where: { userId: id } });
    return { from: target.status };
  });

  if (outcome === "missing") return { ok: false, error: "This user no longer exists." };
  if (outcome === "same") return { ok: false, error: "The user already has that status." };
  if (outcome === "last-admin") {
    return { ok: false, error: "This is the last active admin, so it cannot be suspended or banned." };
  }

  await logActivity({
    userId: authz.user.id,
    action: statusActions[status].action,
    entity: "user",
    entityId: id,
    details: { from: outcome.from, to: status },
  });
  revalidatePath("/admin/employees", "layout");
  revalidatePath("/admin/learners", "layout");
  return { ok: true, message: statusActions[status].message };
}
