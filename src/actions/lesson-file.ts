"use server";

import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { sniffedTypes } from "@/lib/file-sniff";
import {
  checkLessonFile,
  lessonFilePurposes,
  type LessonFileKind,
  type UploadedLessonFile,
} from "@/lib/lesson-file-types";
import { MAX_PARTS, UPLOAD_PART_SIZE } from "@/lib/media-types";
import { signToken, verifyToken } from "@/lib/signed-token";
import { generatePrivateObjectKey, isPrivateStorageConfigured, privateStorage } from "@/lib/storage";
import { authorizeCourseAction } from "@/services/course-access";

// Upload flow for the private lesson bucket: lesson videos, lesson documents,
// lesson resources and course intro videos all use it. Like the media library,
// the browser PUTs bytes straight to R2 with the URLs below and these actions
// decide what may be uploaded and verify what arrived. Unlike the library there
// is no database row for an upload in flight: the state travels in a signed
// token, and the finished file comes back as another token (`fileToken`) that
// the saving action turns into column values with readLessonFileToken().

const NOT_CONFIGURED = "Lesson file storage is not configured yet.";
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const FILE_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const HEAD_BYTES = 64 * 1024;

const startSchema = z.object({
  courseId: z.number().int().positive(),
  purpose: z.enum(lessonFilePurposes),
  name: z.string().trim().min(1).max(255),
  type: z.string().max(100),
  size: z.number().int().positive(),
});

export type StartPrivateUploadData =
  | { token: string; mode: "single"; url: string; contentType: string }
  | { token: string; mode: "multipart"; partSize: number; partCount: number; contentType: string };

export async function startPrivateUpload(
  input: z.input<typeof startSchema>,
): Promise<ActionResult<StartPrivateUploadData>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };
  const { courseId, purpose, name, type, size } = parsed.data;

  const authz = await authorizeCourseAction(courseId, "course.edit");
  if (!authz.ok) return authz.result;
  if (!isPrivateStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const check = checkLessonFile(purpose, { name, type, size });
  if (!check.ok) return { ok: false, error: check.error };

  const partCount = Math.ceil(size / UPLOAD_PART_SIZE);
  if (partCount > MAX_PARTS) return { ok: false, error: `"${name}" is too large.` };

  const key = generatePrivateObjectKey(courseId, name);
  const multipart = size > UPLOAD_PART_SIZE;
  const uploadId = multipart ? await privateStorage.createMultipartUpload(key, check.mime) : "";
  const token = signToken(
    { t: "upload", k: key, u: uploadId, m: check.mime, s: size, f: name, c: courseId, p: purpose, kind: check.kind, uid: authz.user.id },
    SESSION_TTL_SECONDS,
  );

  if (!multipart) {
    return {
      ok: true,
      data: { token, mode: "single", url: await privateStorage.presignPut(key, check.mime), contentType: check.mime },
    };
  }
  return { ok: true, data: { token, mode: "multipart", partSize: UPLOAD_PART_SIZE, partCount, contentType: check.mime } };
}

type UploadSession = {
  key: string;
  uploadId: string;
  mime: string;
  size: number;
  filename: string;
  courseId: number;
  purpose: (typeof lessonFilePurposes)[number];
  kind: LessonFileKind;
  userId: number;
};

function readSession(token: string): UploadSession | null {
  const p = verifyToken(token);
  if (
    !p ||
    p.t !== "upload" ||
    typeof p.k !== "string" ||
    typeof p.u !== "string" ||
    typeof p.m !== "string" ||
    typeof p.s !== "number" ||
    typeof p.f !== "string" ||
    typeof p.c !== "number" ||
    typeof p.uid !== "number" ||
    (p.kind !== "VIDEO" && p.kind !== "DOCUMENT") ||
    !lessonFilePurposes.includes(p.p as never)
  ) {
    return null;
  }
  return {
    key: p.k,
    uploadId: p.u,
    mime: p.m,
    size: p.s,
    filename: p.f,
    courseId: p.c,
    purpose: p.p as UploadSession["purpose"],
    kind: p.kind,
    userId: p.uid,
  };
}

// The caller's own upload session, still allowed to edit that course.
async function authorizeSession(token: string) {
  const session = readSession(token);
  if (!session) return { ok: false as const, result: { ok: false as const, error: "This upload is no longer in progress." } };
  const authz = await authorizeCourseAction(session.courseId, "course.edit");
  if (!authz.ok) return authz;
  if (authz.user.id !== session.userId) {
    return { ok: false as const, result: { ok: false as const, error: "This upload is no longer in progress." } };
  }
  return { ok: true as const, session, user: authz.user };
}

const signSchema = z.object({
  token: z.string().min(1).max(2000),
  partNumbers: z.array(z.number().int().min(1).max(MAX_PARTS)).min(1).max(20),
});

export async function signPrivateUploadParts(
  input: z.input<typeof signSchema>,
): Promise<ActionResult<{ parts: { partNumber: number; url: string }[] }>> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };
  const authz = await authorizeSession(parsed.data.token);
  if (!authz.ok) return authz.result;
  if (!isPrivateStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const { session } = authz;
  if (!session.uploadId) return { ok: false, error: "This upload is no longer in progress." };
  const partCount = Math.ceil(session.size / UPLOAD_PART_SIZE);
  if (parsed.data.partNumbers.some((n) => n > partCount)) return { ok: false, error: "Invalid part number." };

  return {
    ok: true,
    data: { parts: await privateStorage.presignParts(session.key, session.uploadId, parsed.data.partNumbers) },
  };
}

// Returns an error message, or null when the stored object is what was declared.
async function verifyStoredObject(session: UploadSession) {
  const stored = await privateStorage.headObject(session.key);
  if (!stored) return "The uploaded file could not be found.";
  if (stored.size !== session.size) return "The uploaded file size does not match what was declared.";

  const head = Buffer.from(await privateStorage.readObjectHead(session.key, Math.min(stored.size, HEAD_BYTES)));
  const accepted = sniffedTypes[session.mime];
  if (accepted) {
    const detected = await fileTypeFromBuffer(head);
    if (!detected || !accepted.includes(detected.mime)) return "The file content does not match its type.";
  } else if (head.includes(0)) {
    // Plain text and CSV must not be binary.
    return "The file content does not match its type.";
  }
  return null;
}

const completeSchema = z.object({
  token: z.string().min(1).max(2000),
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(MAX_PARTS), etag: z.string().min(1).max(200) }))
    .max(MAX_PARTS)
    .optional(),
});

export async function completePrivateUpload(
  input: z.input<typeof completeSchema>,
): Promise<ActionResult<UploadedLessonFile>> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };
  const authz = await authorizeSession(parsed.data.token);
  if (!authz.ok) return authz.result;
  if (!isPrivateStorageConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const { session } = authz;

  const discard = async (error: string): Promise<ActionResult<UploadedLessonFile>> => {
    try {
      if (session.uploadId) await privateStorage.abortMultipartUpload(session.key, session.uploadId).catch(() => {});
      await privateStorage.deleteObject(session.key);
    } catch (e) {
      console.error("Failed to delete rejected lesson upload", e);
    }
    return { ok: false, error: `"${session.filename}": ${error}` };
  };

  if (session.uploadId) {
    const partCount = Math.ceil(session.size / UPLOAD_PART_SIZE);
    const parts = parsed.data.parts ?? [];
    const numbers = new Set(parts.map((p) => p.partNumber));
    if (parts.length !== partCount || numbers.size !== partCount || parts.some((p) => p.partNumber > partCount)) {
      return { ok: false, error: "Some parts of the file are missing. Try uploading it again." };
    }
    try {
      await privateStorage.completeMultipartUpload(session.key, session.uploadId, parts);
    } catch (error) {
      console.error("Failed to complete multipart lesson upload", error);
      return discard("the upload could not be completed. Try again.");
    }
  }

  let problem: string | null;
  try {
    problem = await verifyStoredObject(session);
  } catch (error) {
    console.error("Failed to verify lesson upload", error);
    return discard("the upload could not be verified. Try again.");
  }
  if (problem) return discard(problem);

  return {
    ok: true,
    data: {
      fileToken: signToken(
        { t: "file", k: session.key, f: session.filename, m: session.mime, s: session.size, c: session.courseId, kind: session.kind },
        FILE_TOKEN_TTL_SECONDS,
      ),
      filename: session.filename,
      mimeType: session.mime,
      size: session.size,
      kind: session.kind,
    },
  };
}

export async function abortPrivateUpload(input: { token: string }): Promise<ActionResult> {
  const parsed = z.object({ token: z.string().min(1).max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const authz = await authorizeSession(parsed.data.token);
  if (!authz.ok) return authz.result;
  if (!isPrivateStorageConfigured()) return { ok: true };

  const { session } = authz;
  try {
    if (session.uploadId) await privateStorage.abortMultipartUpload(session.key, session.uploadId);
    await privateStorage.deleteObject(session.key);
  } catch (error) {
    console.error("Failed to abort lesson upload", error);
  }
  return { ok: true };
}
