// Upload limits and allowed types, shared by the server actions and the uploader.
// No "server-only": the client uploader reads the same rules for early feedback.
export const MB = 1024 * 1024;

export const mediaKinds = ["IMAGE", "VIDEO", "PDF", "DOCUMENT"] as const;
export type MediaKindValue = (typeof mediaKinds)[number];

export const mediaKindLabels: Record<MediaKindValue, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  PDF: "PDF",
  DOCUMENT: "Document",
};

// Size of one multipart part. S3/R2 need at least 5 MB for all but the last.
export const UPLOAD_PART_SIZE = 10 * MB;
export const MAX_PARTS = 10_000;

type TypeRule = {
  kind: MediaKindValue;
  mime: string;
  extensions: string[];
  maxSize: number;
};

// SVG is deliberately absent: it can carry scripts.
export const allowedTypes: TypeRule[] = [
  { kind: "IMAGE", mime: "image/jpeg", extensions: ["jpg", "jpeg"], maxSize: 25 * MB },
  { kind: "IMAGE", mime: "image/png", extensions: ["png"], maxSize: 25 * MB },
  { kind: "IMAGE", mime: "image/webp", extensions: ["webp"], maxSize: 25 * MB },
  { kind: "IMAGE", mime: "image/avif", extensions: ["avif"], maxSize: 25 * MB },
  { kind: "IMAGE", mime: "image/gif", extensions: ["gif"], maxSize: 25 * MB },
  { kind: "PDF", mime: "application/pdf", extensions: ["pdf"], maxSize: 50 * MB },
  { kind: "DOCUMENT", mime: "application/msword", extensions: ["doc"], maxSize: 50 * MB },
  {
    kind: "DOCUMENT",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    maxSize: 50 * MB,
  },
  { kind: "DOCUMENT", mime: "application/vnd.ms-excel", extensions: ["xls"], maxSize: 50 * MB },
  {
    kind: "DOCUMENT",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    maxSize: 50 * MB,
  },
  { kind: "DOCUMENT", mime: "application/vnd.ms-powerpoint", extensions: ["ppt"], maxSize: 50 * MB },
  {
    kind: "DOCUMENT",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
    maxSize: 50 * MB,
  },
  { kind: "DOCUMENT", mime: "text/plain", extensions: ["txt"], maxSize: 50 * MB },
  { kind: "DOCUMENT", mime: "text/csv", extensions: ["csv"], maxSize: 50 * MB },
  { kind: "VIDEO", mime: "video/mp4", extensions: ["mp4"], maxSize: 2048 * MB },
  { kind: "VIDEO", mime: "video/webm", extensions: ["webm"], maxSize: 2048 * MB },
  { kind: "VIDEO", mime: "video/quicktime", extensions: ["mov"], maxSize: 2048 * MB },
];

export function fileExtension(filename: string) {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i + 1).toLowerCase();
}

export type FileCheck =
  | { ok: true; kind: MediaKindValue; mime: string; maxSize: number }
  | { ok: false; error: string };

// Checks mime type, extension and size together. Browsers sometimes report an
// empty or generic type, which is rejected: the declared type must be allowed.
export function checkFile(file: { name: string; type: string; size: number }): FileCheck {
  const mime = file.type.toLowerCase();
  const rule = allowedTypes.find((t) => t.mime === mime);
  if (!rule) return { ok: false, error: `"${file.name}": this file type is not allowed.` };
  if (!rule.extensions.includes(fileExtension(file.name))) {
    return { ok: false, error: `"${file.name}": the file extension does not match its type.` };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: `"${file.name}" is empty.` };
  }
  if (file.size > rule.maxSize) {
    return { ok: false, error: `"${file.name}" is too large. The limit is ${formatLimit(rule.maxSize)}.` };
  }
  return { ok: true, kind: rule.kind, mime: rule.mime, maxSize: rule.maxSize };
}

function formatLimit(bytes: number) {
  return bytes >= 1024 * MB ? `${bytes / (1024 * MB)} GB` : `${bytes / MB} MB`;
}

// For the file input's `accept` attribute.
export const acceptAttribute = allowedTypes
  .flatMap((t) => [t.mime, ...t.extensions.map((e) => `.${e}`)])
  .join(",");

export const uploadLimitsText = "Images up to 25 MB, PDFs and documents up to 50 MB, video up to 2 GB.";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

// What the library, picker and editor need to show one file. Plain JSON: safe
// to pass from server to client components and out of server actions.
export type MediaSummary = {
  id: number;
  title: string | null;
  altText: string | null;
  filename: string;
  kind: MediaKindValue;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string | null;
  folderId: number | null;
  createdAt: string;
};

export type MediaFolderSummary = { id: number; name: string; itemCount: number; folderCount: number };
export type MediaBreadcrumb = { id: number; name: string };
