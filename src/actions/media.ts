"use server";

import { revalidatePath } from "next/cache";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { sniffedTypes } from "@/lib/file-sniff";
import { formValues, type FormState } from "@/lib/form-state";
import {
  checkFile,
  MAX_PARTS,
  UPLOAD_PART_SIZE,
  allowedTypes,
  mediaKinds,
  type MediaFolderSummary,
  type MediaBreadcrumb,
  type MediaSummary,
} from "@/lib/media-types";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  deleteObject,
  generateObjectKey,
  headObject,
  isStorageConfigured,
  presignParts,
  presignPut,
  readObjectHead,
} from "@/lib/storage";
import { logActivity } from "@/services/activity";
import {
  getFolderPath,
  getMediaUsage,
  isMediaKind,
  listFolders,
  listMedia,
  toSummary,
} from "@/services/media";
import { authorizeAction, can } from "@/services/user";

const NOT_CONFIGURED = "File storage is not configured yet.";

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const folderIdSchema = z.number().int().positive().nullable();

function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    ok: false,
    error: "Fix the highlighted fields and try again.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formValues(formData),
  };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// Upload flow. The browser PUTs bytes straight to R2 with the URLs below; these
// actions decide what may be uploaded and verify what arrived.
// ---------------------------------------------------------------------------

const startSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().max(100),
  size: z.number().int().positive(),
  folderId: folderIdSchema,
});

export type StartUploadData =
  | { mediaId: number; mode: "single"; url: string; contentType: string }
  | { mediaId: number; mode: "multipart"; partSize: number; partCount: number; contentType: string };

export async function startUpload(input: z.input<typeof startSchema>): Promise<ActionResult<StartUploadData>> {
  const authz = await authorizeAction("media.upload");
  if (!authz.ok) return authz.result;
  if (!isStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };
  const { name, type, size, folderId } = parsed.data;

  const check = checkFile({ name, type, size });
  if (!check.ok) return { ok: false, error: check.error };

  if (folderId !== null && !(await db.mediaFolder.findUnique({ where: { id: folderId }, select: { id: true } }))) {
    return { ok: false, error: "That folder no longer exists." };
  }

  const key = generateObjectKey(name);
  const multipart = size > UPLOAD_PART_SIZE;
  const partCount = Math.ceil(size / UPLOAD_PART_SIZE);
  if (partCount > MAX_PARTS) return { ok: false, error: `"${name}" is too large.` };

  const uploadId = multipart ? await createMultipartUpload(key, check.mime) : null;
  const media = await db.media.create({
    data: {
      key,
      originalFilename: name,
      mimeType: check.mime,
      kind: check.kind,
      size: BigInt(size),
      folderId,
      uploadedById: authz.user.id,
      uploadStatus: "PENDING",
      multipartUploadId: uploadId,
    },
    select: { id: true },
  });

  if (!multipart) {
    return {
      ok: true,
      data: { mediaId: media.id, mode: "single", url: await presignPut(key, check.mime), contentType: check.mime },
    };
  }
  return {
    ok: true,
    data: { mediaId: media.id, mode: "multipart", partSize: UPLOAD_PART_SIZE, partCount, contentType: check.mime },
  };
}

// The caller's own unfinished upload, or null.
async function ownPendingUpload(mediaId: number, userId: number) {
  const media = await db.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      key: true,
      size: true,
      mimeType: true,
      kind: true,
      originalFilename: true,
      multipartUploadId: true,
      uploadStatus: true,
      uploadedById: true,
    },
  });
  if (!media || media.uploadStatus !== "PENDING" || media.uploadedById !== userId) return null;
  return media;
}

const signSchema = z.object({
  mediaId: z.number().int().positive(),
  partNumbers: z.array(z.number().int().min(1).max(MAX_PARTS)).min(1).max(20),
});

export async function signUploadParts(
  input: z.input<typeof signSchema>,
): Promise<ActionResult<{ parts: { partNumber: number; url: string }[] }>> {
  const authz = await authorizeAction("media.upload");
  if (!authz.ok) return authz.result;
  if (!isStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };

  const media = await ownPendingUpload(parsed.data.mediaId, authz.user.id);
  if (!media?.multipartUploadId) return { ok: false, error: "This upload is no longer in progress." };
  const partCount = Math.ceil(Number(media.size) / UPLOAD_PART_SIZE);
  if (parsed.data.partNumbers.some((n) => n > partCount)) return { ok: false, error: "Invalid part number." };

  return { ok: true, data: { parts: await presignParts(media.key, media.multipartUploadId, parsed.data.partNumbers) } };
}

const HEAD_BYTES = 64 * 1024;
const IMAGE_HEAD_BYTES = 1024 * 1024;

// Returns an error message, or the image size when it is an image.
async function verifyStoredObject(media: NonNullable<Awaited<ReturnType<typeof ownPendingUpload>>>) {
  const declared = Number(media.size);
  const rule = allowedTypes.find((t) => t.mime === media.mimeType);
  const stored = await headObject(media.key);
  if (!stored) return { error: "The uploaded file could not be found." };
  if (stored.size !== declared) return { error: "The uploaded file size does not match what was declared." };
  if (!rule || stored.size > rule.maxSize) return { error: "The uploaded file is too large." };

  const head = Buffer.from(
    await readObjectHead(media.key, Math.min(stored.size, media.kind === "IMAGE" ? IMAGE_HEAD_BYTES : HEAD_BYTES)),
  );
  const accepted = sniffedTypes[media.mimeType];
  if (accepted) {
    const detected = await fileTypeFromBuffer(head);
    if (!detected || !accepted.includes(detected.mime)) {
      return { error: "The file content does not match its type." };
    }
  } else if (head.includes(0)) {
    // Plain text and CSV must not be binary.
    return { error: "The file content does not match its type." };
  }

  if (media.kind !== "IMAGE") return { dimensions: null };
  try {
    const { width, height } = imageSize(head);
    return { dimensions: width && height ? { width, height } : null };
  } catch {
    return { error: "The image could not be read." };
  }
}

const completeSchema = z.object({
  mediaId: z.number().int().positive(),
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(MAX_PARTS), etag: z.string().min(1).max(200) }))
    .max(MAX_PARTS)
    .optional(),
});

export async function completeUpload(input: z.input<typeof completeSchema>): Promise<ActionResult<MediaSummary>> {
  const authz = await authorizeAction("media.upload");
  if (!authz.ok) return authz.result;
  if (!isStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };

  const media = await ownPendingUpload(parsed.data.mediaId, authz.user.id);
  if (!media) return { ok: false, error: "This upload is no longer in progress." };

  const discard = async (error: string): Promise<ActionResult<MediaSummary>> => {
    try {
      await deleteObject(media.key);
    } catch (e) {
      console.error("Failed to delete rejected upload", e);
    }
    await db.media.delete({ where: { id: media.id } });
    return { ok: false, error: `"${media.originalFilename}": ${error}` };
  };

  if (media.multipartUploadId) {
    const partCount = Math.ceil(Number(media.size) / UPLOAD_PART_SIZE);
    const parts = parsed.data.parts ?? [];
    const numbers = new Set(parts.map((p) => p.partNumber));
    if (parts.length !== partCount || numbers.size !== partCount || parts.some((p) => p.partNumber > partCount)) {
      return { ok: false, error: "Some parts of the file are missing. Try uploading it again." };
    }
    try {
      await completeMultipartUpload(media.key, media.multipartUploadId, parts);
    } catch (error) {
      console.error("Failed to complete multipart upload", error);
      return discard("the upload could not be completed. Try again.");
    }
  }

  let verdict: Awaited<ReturnType<typeof verifyStoredObject>>;
  try {
    verdict = await verifyStoredObject(media);
  } catch (error) {
    console.error("Failed to verify upload", error);
    return discard("the upload could not be verified. Try again.");
  }
  if ("error" in verdict && verdict.error) return discard(verdict.error);

  const dimensions = "dimensions" in verdict ? verdict.dimensions : null;
  const ready = await db.media.update({
    where: { id: media.id },
    data: {
      uploadStatus: "READY",
      multipartUploadId: null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    },
    select: {
      id: true, key: true, title: true, altText: true, originalFilename: true, kind: true, mimeType: true,
      size: true, width: true, height: true, folderId: true, createdAt: true,
    },
  });
  await logActivity({
    userId: authz.user.id,
    action: "media.upload",
    entity: "media",
    entityId: ready.id,
    details: { filename: ready.originalFilename, size: Number(ready.size), kind: ready.kind },
  });
  revalidatePath("/admin/media");
  return { ok: true, data: toSummary(ready) };
}

export async function abortUpload(input: { mediaId: number }): Promise<ActionResult> {
  const authz = await authorizeAction("media.upload");
  if (!authz.ok) return authz.result;

  const parsed = z.object({ mediaId: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const media = await ownPendingUpload(parsed.data.mediaId, authz.user.id);
  if (!media) return { ok: true };
  if (isStorageConfigured()) {
    try {
      if (media.multipartUploadId) await abortMultipartUpload(media.key, media.multipartUploadId);
      await deleteObject(media.key);
    } catch (error) {
      console.error("Failed to abort upload", error);
    }
  }
  await db.media.deleteMany({ where: { id: media.id, uploadStatus: "PENDING" } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use at most ${max} characters.`).optional();

const mediaDetailsSchema = z.object({
  id: z.coerce.number().int().positive(),
  originalFilename: z.string().trim().min(1, "Enter a file name.").max(255, "Use at most 255 characters."),
  title: optionalText(200),
  altText: optionalText(500),
  caption: optionalText(2000),
  description: optionalText(5000),
});

export async function updateMedia(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("media.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = mediaDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { id, originalFilename, title, altText, caption, description } = parsed.data;

  const current = await db.media.findUnique({ where: { id }, select: { mimeType: true, originalFilename: true } });
  if (!current) return { ok: false, error: "This file no longer exists.", values: formValues(formData) };
  // Renaming changes the display name only; the stored key never changes.
  const rule = allowedTypes.find((t) => t.mime === current.mimeType);
  const ext = originalFilename.slice(originalFilename.lastIndexOf(".") + 1).toLowerCase();
  if (rule && !rule.extensions.includes(ext)) {
    const message = `Keep a .${rule.extensions[0]} extension so the name matches the file type.`;
    return { ok: false, error: message, fieldErrors: { originalFilename: [message] }, values: formValues(formData) };
  }

  await db.media.update({
    where: { id },
    data: {
      originalFilename,
      title: title || null,
      altText: altText || null,
      caption: caption || null,
      description: description || null,
    },
  });
  await logActivity({
    userId: authz.user.id,
    action: "media.update",
    entity: "media",
    entityId: id,
    details: { filename: originalFilename },
  });
  revalidatePath("/admin/media", "layout");
  return { ok: true, message: "Media saved." };
}

// Used with ConfirmDialog: field is `id`.
export async function deleteMedia(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("media.delete");
  if (!authz.ok) return authz.result;

  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id } = parsed.data;

  const media = await db.media.findUnique({ where: { id }, select: { key: true, originalFilename: true } });
  if (!media) return { ok: false, error: "This file no longer exists." };

  const usage = await getMediaUsage(id);
  if (usage.length > 0) {
    const shown = usage.slice(0, 3).map((u) => u.label).join("; ");
    const more = usage.length > 3 ? ` and ${usage.length - 3} more` : "";
    return { ok: false, error: `This file is in use and cannot be deleted: ${shown}${more}. Remove it there first.` };
  }
  if (!isStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };

  try {
    await deleteObject(media.key);
  } catch (error) {
    console.error("Failed to delete stored object", error);
    return { ok: false, error: "The file could not be removed from storage. Try again." };
  }
  await db.media.delete({ where: { id } });
  await logActivity({
    userId: authz.user.id,
    action: "media.delete",
    entity: "media",
    entityId: id,
    details: { filename: media.originalFilename },
  });
  revalidatePath("/admin/media", "layout");
  return { ok: true, message: "File deleted." };
}

const moveSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
  folderId: z.string().optional(),
});

// Fields: `id` (repeatable) and `folderId` (empty = top level).
export async function moveMedia(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("media.edit");
  if (!authz.ok) return authz.result;

  const parsed = moveSchema.safeParse({ ids: formData.getAll("id"), folderId: formData.get("folderId") ?? "" });
  if (!parsed.success) return { ok: false, error: "Choose at least one file." };
  const folderId = parsed.data.folderId ? Number(parsed.data.folderId) : null;
  if (folderId !== null) {
    if (!Number.isInteger(folderId) || !(await db.mediaFolder.findUnique({ where: { id: folderId }, select: { id: true } }))) {
      return { ok: false, error: "That folder no longer exists." };
    }
  }
  const { count } = await db.media.updateMany({
    where: { id: { in: parsed.data.ids }, uploadStatus: "READY" },
    data: { folderId },
  });
  await logActivity({
    userId: authz.user.id,
    action: "media.update",
    entity: "media",
    entityId: parsed.data.ids.length === 1 ? parsed.data.ids[0] : null,
    details: { moved: count, folderId },
  });
  revalidatePath("/admin/media", "layout");
  return { ok: true, message: count === 1 ? "File moved." : `${count} files moved.` };
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a folder name.")
  .max(100, "Use at most 100 characters.")
  .regex(/^[^/\\]+$/, "Folder names cannot contain slashes.");

const NAME_TAKEN = "A folder with this name already exists here.";

function nameTaken(formData: FormData): FormState {
  return { ok: false, error: NAME_TAKEN, fieldErrors: { name: [NAME_TAKEN] }, values: formValues(formData) };
}

// MySQL treats NULL parents as distinct, so top-level names are checked here.
async function folderNameExists(parentId: number | null, name: string, exceptId?: number) {
  const found = await db.mediaFolder.findFirst({
    where: { parentId, name, id: exceptId ? { not: exceptId } : undefined },
    select: { id: true },
  });
  return Boolean(found);
}

const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: z.string().optional(),
});

export async function createFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("media.upload");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = createFolderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const parentId = parsed.data.parentId ? Number(parsed.data.parentId) : null;
  if (parentId !== null && !(await db.mediaFolder.findUnique({ where: { id: parentId }, select: { id: true } }))) {
    return { ok: false, error: "The parent folder no longer exists.", values: formValues(formData) };
  }
  if (await folderNameExists(parentId, parsed.data.name)) return nameTaken(formData);

  let id: number;
  try {
    ({ id } = await db.mediaFolder.create({
      data: { name: parsed.data.name, parentId },
      select: { id: true },
    }));
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken(formData);
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "media-folder.create",
    entity: "media-folder",
    entityId: id,
    details: { name: parsed.data.name },
  });
  revalidatePath("/admin/media");
  return { ok: true, message: `Folder "${parsed.data.name}" created.` };
}

export async function renameFolder(_prev: FormState, formData: FormData): Promise<FormState> {
  const authz = await authorizeAction("media.edit");
  if (!authz.ok) return { ...authz.result, values: formValues(formData) };

  const parsed = z.object({ id: idSchema.shape.id, name: folderNameSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const { id, name } = parsed.data;

  const folder = await db.mediaFolder.findUnique({ where: { id }, select: { name: true, parentId: true } });
  if (!folder) return { ok: false, error: "This folder no longer exists.", values: formValues(formData) };
  if (await folderNameExists(folder.parentId, name, id)) return nameTaken(formData);

  try {
    await db.mediaFolder.update({ where: { id }, data: { name } });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTaken(formData);
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "media-folder.update",
    entity: "media-folder",
    entityId: id,
    details: { from: folder.name, to: name },
  });
  revalidatePath("/admin/media", "layout");
  return { ok: true, message: "Folder renamed." };
}

// Used with ConfirmDialog: field is `id`. Only empty folders can be deleted.
export async function deleteFolder(formData: FormData): Promise<ActionResult> {
  const authz = await authorizeAction("media.delete");
  if (!authz.ok) return authz.result;

  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { id } = parsed.data;

  const folder = await db.mediaFolder.findUnique({
    where: { id },
    select: { name: true, _count: { select: { media: true, children: true } } },
  });
  if (!folder) return { ok: false, error: "This folder no longer exists." };
  if (folder._count.media > 0 || folder._count.children > 0) {
    return { ok: false, error: `"${folder.name}" is not empty. Move or delete its contents first.` };
  }
  try {
    await db.mediaFolder.delete({ where: { id } });
  } catch (error) {
    // Something was added between the check and the delete (restricted FK).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, error: `"${folder.name}" is not empty. Move or delete its contents first.` };
    }
    throw error;
  }
  await logActivity({
    userId: authz.user.id,
    action: "media-folder.delete",
    entity: "media-folder",
    entityId: id,
    details: { name: folder.name },
  });
  revalidatePath("/admin/media", "layout");
  return { ok: true, message: "Folder deleted." };
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

const pickerSchema = z.object({
  search: z.string().trim().max(100).optional(),
  kind: z.enum(mediaKinds).optional(),
  folderId: folderIdSchema,
  page: z.number().int().min(1).max(10_000),
});

export type PickerPage = {
  items: MediaSummary[];
  folders: MediaFolderSummary[];
  path: MediaBreadcrumb[];
  total: number;
  page: number;
  pageSize: number;
  // Storage is set up and the user may upload, so the picker offers inline upload.
  uploadEnabled: boolean;
};

// Called from the picker dialog (a server action instead of a client fetch).
export async function loadPickerPage(input: z.input<typeof pickerSchema>): Promise<ActionResult<PickerPage>> {
  const authz = await authorizeAction("media.view");
  if (!authz.ok) return authz.result;

  const parsed = pickerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { search, kind, folderId, page } = parsed.data;

  const searching = Boolean(search);
  const [list, folders, path] = await Promise.all([
    listMedia({
      search,
      kind: isMediaKind(kind) ? kind : undefined,
      folderId,
      sort: "date",
      order: "desc",
      page,
      pageSize: 18,
    }),
    searching ? Promise.resolve([]) : listFolders(folderId),
    getFolderPath(folderId),
  ]);
  return {
    ok: true,
    data: {
      items: list.items,
      folders,
      path,
      total: list.total,
      page: list.page,
      pageSize: list.pageSize,
      uploadEnabled: isStorageConfigured() && can(authz.user, "media.upload"),
    },
  };
}
