// SCORM 1.2 as pure functions: which files in a package's zip are safe to keep
// and the rules of what a running package may tell us. No storage, no
// database: src/services/scorm.ts uses these. The manifest is read in
// src/lib/scorm-manifest.ts.

export const SCORM_MAX_ZIP_BYTES = 500 * 1024 * 1024;
export const SCORM_MAX_UNPACKED_BYTES = 1024 * 1024 * 1024;
export const SCORM_MAX_FILES = 5000;
export const SCORM_MAX_SUSPEND_DATA = 1024 * 1024;

// ---------------------------------------------------------------- files

// A path inside the package as a clean relative one, or null when it tries to
// leave the package folder or is not a plain file path.
export function normalisePath(path: string) {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[a-z]+:/i.test(path)) return null;
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") return null;
    parts.push(part);
  }
  return parts.length > 0 && parts.join("/").length <= 400 ? parts.join("/") : null;
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  xsd: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf",
  swf: "application/x-shockwave-flash",
};

// What a package file is served as; anything unknown is a download, never a page.
export function scormContentType(path: string) {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

// ---------------------------------------------------------------- what a package reports

export const scormStatuses = ["not attempted", "incomplete", "completed", "passed", "failed", "browsed"] as const;
export type ScormStatus = (typeof scormStatuses)[number];

// What we keep per learner, and hand back when the package starts again.
export type ScormProgress = {
  lessonStatus: ScormStatus;
  lessonLocation: string;
  scoreRaw: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  suspendData: string;
  totalTimeSeconds: number;
};

export const emptyScormProgress: ScormProgress = {
  lessonStatus: "not attempted",
  lessonLocation: "",
  scoreRaw: null,
  scoreMin: null,
  scoreMax: null,
  suspendData: "",
  totalTimeSeconds: 0,
};

// "0000:12:34.56" (the session time a package reports) as whole seconds.
export function parseScormTime(value: string) {
  const match = /^(\d{1,4}):(\d{2}):(\d{2})(\.\d+)?$/.exec(value.trim());
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

// Seconds as the "HHHH:MM:SS" a package expects for total_time.
export function formatScormTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const two = (n: number) => String(n).padStart(2, "0");
  return `${String(Math.floor(whole / 3600)).padStart(4, "0")}:${two(Math.floor((whole % 3600) / 60))}:${two(whole % 60)}`;
}

// The status to record. A package that reports a score against a pass mark but
// leaves the verdict to the LMS (status "completed" or "incomplete" with a
// mastery score in the manifest) is marked passed or failed here, as the
// standard asks.
export function resolveScormStatus(status: ScormStatus, scoreRaw: number | null, masteryScore: number | null): ScormStatus {
  if (masteryScore !== null && scoreRaw !== null && (status === "completed" || status === "incomplete")) {
    return scoreRaw >= masteryScore ? "passed" : "failed";
  }
  return status;
}

// A lesson is done when the package says it was finished or passed. A fail is
// not: the learner can go through it again.
export const scormStatusCompletes = (status: ScormStatus) => status === "completed" || status === "passed";

const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// Whatever the browser sends, cut down to known fields of sane size. Null when
// it is not progress at all.
export function sanitiseScormProgress(raw: unknown): (ScormProgress & { sessionSeconds: number }) | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const status = scormStatuses.find((s) => s === input.lessonStatus);
  if (!status) return null;
  const suspendData = typeof input.suspendData === "string" ? input.suspendData : "";
  if (suspendData.length > SCORM_MAX_SUSPEND_DATA) return null;
  return {
    lessonStatus: status,
    lessonLocation: typeof input.lessonLocation === "string" ? input.lessonLocation.slice(0, 1000) : "",
    scoreRaw: number(input.scoreRaw),
    scoreMin: number(input.scoreMin),
    scoreMax: number(input.scoreMax),
    suspendData,
    totalTimeSeconds: 0,
    // Time spent since the last save; capped so one bad value cannot add days.
    sessionSeconds: Math.min(12 * 3600, Math.max(0, Math.floor(number(input.sessionSeconds) ?? 0))),
  };
}
