"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { setCertificateRevoked } from "@/services/certificate";
import { authorizeAction } from "@/services/user";

// Revoking keeps the certificate: its public page then says it is revoked.
// Restoring makes it valid again. Needs certificate.manage.

const idSchema = z.coerce.number().int().positive();

async function setRevoked(formData: FormData, revoked: boolean): Promise<ActionResult> {
  const id = idSchema.safeParse(formData.get("certificateId"));
  if (!id.success) return { ok: false, error: "This certificate no longer exists." };
  const authz = await authorizeAction("certificate.manage");
  if (!authz.ok) return authz.result;

  const result = await setCertificateRevoked(id.data, revoked, authz.user.id);
  if (!result.ok) return result;
  revalidatePath("/admin/certificates");
  revalidatePath("/admin/enrolments", "layout");
  revalidatePath("/admin/learners", "layout");
  revalidatePath("/my-certificates");
  revalidatePath("/admin");
  return { ok: true, message: revoked ? "Certificate revoked." : "Certificate restored." };
}

export async function revokeCertificate(formData: FormData) {
  return setRevoked(formData, true);
}

export async function restoreCertificate(formData: FormData) {
  return setRevoked(formData, false);
}
