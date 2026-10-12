import { MB, allowedTypes, fileExtension, formatBytes } from "@/lib/media-types";

// Rules for files in the private lesson bucket, shared by the upload actions and
// the uploader. No "server-only": the browser reads them for early feedback.
// Images are not accepted here: thumbnails go through the media library.

// What a file is for. All four use the same upload actions.
export const lessonFilePurposes = ["lesson-video", "lesson-document", "lesson-resource", "intro-video"] as const;
export type LessonFilePurpose = (typeof lessonFilePurposes)[number];

export type LessonFileKind = "VIDEO" | "DOCUMENT";

const VIDEO_MAX = 2048 * MB;
const DOCUMENT_MAX = 50 * MB;

type Rule = { kind: LessonFileKind; mime: string; extensions: string[]; maxSize: number };

const videoRules: Rule[] = [
  { kind: "VIDEO", mime: "video/mp4", extensions: ["mp4"], maxSize: VIDEO_MAX },
  { kind: "VIDEO", mime: "video/webm", extensions: ["webm"], maxSize: VIDEO_MAX },
];

// PDF, Office files, plain text and CSV come from the media library list, plus zip.
const documentRules: Rule[] = [
  ...allowedTypes
    .filter((t) => t.kind === "PDF" || t.kind === "DOCUMENT")
    .map((t): Rule => ({ kind: "DOCUMENT", mime: t.mime, extensions: t.extensions, maxSize: DOCUMENT_MAX })),
  { kind: "DOCUMENT", mime: "application/zip", extensions: ["zip"], maxSize: DOCUMENT_MAX },
  { kind: "DOCUMENT", mime: "application/x-zip-compressed", extensions: ["zip"], maxSize: DOCUMENT_MAX },
];

export function lessonFileRules(purpose: LessonFilePurpose) {
  return purpose === "lesson-video" || purpose === "intro-video" ? videoRules : documentRules;
}

export type LessonFileCheck =
  | { ok: true; kind: LessonFileKind; mime: string; maxSize: number }
  | { ok: false; error: string };

// Checks mime type, extension and size together, like checkFile for the library.
export function checkLessonFile(
  purpose: LessonFilePurpose,
  file: { name: string; type: string; size: number },
): LessonFileCheck {
  const rule = lessonFileRules(purpose).find((r) => r.mime === file.type.toLowerCase());
  if (!rule) return { ok: false, error: `"${file.name}": this file type is not allowed here. ${lessonFileLimitsText(purpose)}` };
  if (!rule.extensions.includes(fileExtension(file.name))) {
    return { ok: false, error: `"${file.name}": the file extension does not match its type.` };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: `"${file.name}" is empty.` };
  if (file.size > rule.maxSize) {
    return { ok: false, error: `"${file.name}" is too large. The limit is ${formatBytes(rule.maxSize)}.` };
  }
  return { ok: true, kind: rule.kind, mime: rule.mime, maxSize: rule.maxSize };
}

// For the file input's `accept` attribute.
export function lessonFileAccept(purpose: LessonFilePurpose) {
  return lessonFileRules(purpose)
    .flatMap((r) => [r.mime, ...r.extensions.map((e) => `.${e}`)])
    .join(",");
}

export function lessonFileLimitsText(purpose: LessonFilePurpose) {
  return lessonFileRules(purpose)[0].kind === "VIDEO"
    ? "MP4 or WebM video up to 2 GB."
    : "PDF, Office, text or zip files up to 50 MB.";
}

// What a finished upload gives back. The token proves the server accepted the
// file for this course; pass it to readLessonFileToken() in the action that
// attaches the file to a lesson, resource or course.
export type UploadedLessonFile = {
  fileToken: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: LessonFileKind;
};
