"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readAllNotifications, readNotification } from "@/services/notification";
import { requireUser } from "@/services/user";

const idSchema = z.coerce.number().int().positive();

// Opening a notification marks it read and goes where it points. Only links
// inside this site are followed.
export async function openNotification(formData: FormData) {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  const opened = await readNotification(user.id, id.data);
  revalidatePath("/", "layout");
  if (opened?.link && opened.link.startsWith("/") && !opened.link.startsWith("//")) redirect(opened.link);
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await readAllNotifications(user.id);
  revalidatePath("/", "layout");
}
