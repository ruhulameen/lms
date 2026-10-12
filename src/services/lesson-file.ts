import "server-only";
import { isPrivateStorageConfigured, privateStorage } from "@/lib/storage";
import { verifyToken } from "@/lib/signed-token";
import type { LessonFileKind } from "@/lib/lesson-file-types";

// What a finished private upload looks like once the token is checked: the
// values to store on a lesson, resource or course row.
export type StoredLessonFile = {
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: LessonFileKind;
};

// Call from the action that attaches an uploaded file to a lesson, resource or
// course intro video: it proves the file was accepted by completePrivateUpload
// for this course, so a client cannot attach an arbitrary key.
export function readLessonFileToken(fileToken: string, courseId: number): StoredLessonFile | null {
  const p = verifyToken(fileToken);
  if (!p || p.t !== "file" || p.c !== courseId) return null;
  if (
    typeof p.k !== "string" ||
    !p.k.startsWith(`lessons/${courseId}/`) ||
    typeof p.f !== "string" ||
    typeof p.m !== "string" ||
    typeof p.s !== "number" ||
    (p.kind !== "VIDEO" && p.kind !== "DOCUMENT")
  ) {
    return null;
  }
  return { key: p.k, filename: p.f, mimeType: p.m, size: p.s, kind: p.kind };
}

// Deletes a stored lesson file, e.g. after it is replaced or its lesson removed.
// Never throws: a leftover object is harmless, a failed save is not. Returns
// whether the object is gone (true also when private storage is not configured).
export async function removeLessonFile(key: string | null | undefined) {
  if (!key || !isPrivateStorageConfigured()) return true;
  try {
    await privateStorage.deleteObject(key);
    return true;
  } catch (error) {
    console.error("Failed to delete lesson file", error);
    return false;
  }
}
