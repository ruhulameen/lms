"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BIO_MAX } from "@/lib/blog-post";
import { db } from "@/lib/db";
import { formValues, type FormState } from "@/lib/form-state";
import { logActivity } from "@/services/activity";
import { authorizeAction, can, FORBIDDEN_MESSAGE } from "@/services/user";

const schema = z.object({
  id: z.coerce.number().int().positive(),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `Use at most ${BIO_MAX} characters.`)
    .transform((v) => v || null),
});

// The public bio shown under articles. Authors edit their own; user.edit covers anyone's.
export async function updateAuthorBio(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("post.view");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Fix the highlighted fields and try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: formValues(formData),
    };
  }
  const { id, bio } = parsed.data;
  if (id !== authz.user.id && !can(authz.user, "user.edit")) {
    return { ok: false, error: FORBIDDEN_MESSAGE, values: formValues(formData) };
  }
  const user = await db.user.findUnique({ where: { id }, select: { bio: true } });
  if (!user) return { ok: false, error: "This user no longer exists.", values: formValues(formData) };
  if (user.bio === bio) return { ok: true, message: "Nothing to change." };

  await db.user.update({ where: { id }, data: { bio } });
  await logActivity({ userId: authz.user.id, action: "author.bio-update", entity: "user", entityId: id });
  revalidatePath("/blog", "layout");
  revalidatePath("/admin/blog/authors");
  return { ok: true, message: "Bio saved." };
}
