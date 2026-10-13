import { db } from "@/lib/db";
import { normalisePath, scormContentType } from "@/lib/scorm";
import { isPrivateStorageConfigured, privateStorage } from "@/lib/storage";
import { canAccessLesson } from "@/services/lesson-access";
import { getCurrentUser } from "@/services/user";

// Serves the files of an unpacked SCORM package: /scorm/<lessonId>/<path inside
// the package>. They have to come from the site's own address, not straight
// from storage, because a package finds the LMS by reaching into the page
// around its frame, which browsers only allow within one site. Every file is
// checked against the same rule as any lesson file (enrolled learner, course
// staff, or a free preview).
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string; path: string[] }> }) {
  const { lessonId, path } = await params;
  const id = /^\d{1,10}$/.test(lessonId) ? Number(lessonId) : null;
  const file = normalisePath(path.join("/"));
  if (!id || !file) return new Response("Not found.", { status: 404 });

  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { id: true, courseId: true, isFreePreview: true, published: true, type: true, scormPrefix: true },
  });
  if (!lesson || lesson.type !== "SCORM" || !lesson.scormPrefix || !isPrivateStorageConfigured()) return new Response("Not found.", { status: 404 });
  if (!(await canAccessLesson(await getCurrentUser(), lesson))) return new Response("You do not have access to this lesson.", { status: 403 });

  // Range requests are passed on so video and audio inside a package can seek.
  const range = request.headers.get("range") ?? undefined;
  const stored = await privateStorage.getObject(`${lesson.scormPrefix}${file}`, range);
  if (!stored) return new Response("Not found.", { status: 404 });

  const headers = new Headers({
    "content-type": scormContentType(file),
    "accept-ranges": "bytes",
    // The learner's browser may keep a file for an hour; nothing shared may.
    "cache-control": "private, max-age=3600",
    "x-content-type-options": "nosniff",
    // Only this site may put package pages in a frame.
    "content-security-policy": "frame-ancestors 'self'",
  });
  if (stored.size !== null) headers.set("content-length", String(stored.size));
  if (stored.contentRange) headers.set("content-range", stored.contentRange);
  if (stored.etag) headers.set("etag", stored.etag);
  return new Response(stored.body.transformToWebStream(), { status: range && stored.contentRange ? 206 : 200, headers });
}
