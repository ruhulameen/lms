"use client";

import { FileText, Trash2 } from "lucide-react";
import { attachLessonFile, detachLessonFile } from "@/actions/course-curriculum";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { LessonFileUploader } from "@/components/admin/lesson-file-uploader";
import { formatBytes } from "@/lib/media-types";

type FileLessonType = "VIDEO" | "DOCUMENT" | "SCORM";

type LessonFileSectionProps = {
  courseId: number;
  lessonId: number;
  type: FileLessonType;
  // The attached file's public details (never its storage key).
  file: { name: string; size: number; mimeType: string } | null;
  // Short-lived signed link from getLessonFileUrl(), for the staff preview.
  previewUrl: string | null;
  canEdit: boolean;
};

const words: Record<FileLessonType, { heading: string; label: string; purpose: "lesson-video" | "lesson-document" | "lesson-scorm" }> = {
  VIDEO: { heading: "Video", label: "video", purpose: "lesson-video" },
  DOCUMENT: { heading: "Document", label: "document", purpose: "lesson-document" },
  SCORM: { heading: "SCORM package", label: "package", purpose: "lesson-scorm" },
};

// The main file of a video, document or SCORM lesson: preview, replace, remove.
// Uploading saves the file straight away; the rest of the lesson form is
// saved with its own button.
export function LessonFileSection({ courseId, lessonId, type, file, previewUrl, canEdit }: LessonFileSectionProps) {
  const { heading, label, purpose } = words[type];
  return (
    <section aria-label={`Lesson ${label}`} className="grid gap-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
      {type === "SCORM" && (
        <p className="text-xs text-slate-500">
          A course exported from an authoring tool (Articulate Rise or Storyline, iSpring, Adobe Captivate and others) as <strong>SCORM 1.2</strong>, in one
          zip file. Learners go through it inside the lesson; it is ticked off when the package reports that they finished or passed. Only upload packages
          from a source you trust: a package runs its own code in the learner&apos;s browser.
        </p>
      )}
      {file ? (
        <div className="grid gap-3">
          {type === "VIDEO" && previewUrl && (
            <video controls preload="metadata" src={previewUrl} className="aspect-video w-full max-w-2xl rounded-lg bg-black" aria-label="Video preview" />
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <FileText className="size-4 shrink-0 text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium" title={file.name}>
              {file.name}
            </span>
            <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
            {type === "DOCUMENT" && previewUrl && (
              <a href={previewUrl} className="text-sm text-blue-700 hover:underline" target="_blank" rel="noreferrer">
                Download
              </a>
            )}
            {canEdit && (
              <ConfirmDialog
                action={async () => detachLessonFile({ courseId, lessonId })}
                title={`Remove this ${label}?`}
                description={`The file is deleted from storage. The lesson is hidden from learners until you add a new ${label}.`}
                trigger={<><Trash2 aria-hidden /> Remove</>}
                triggerVariant="ghost"
                triggerLabel={`Remove the ${label}`}
                confirmLabel="Remove file"
                destructive
              />
            )}
          </div>
          {type === "SCORM" ? (
            <p className="text-xs text-slate-500">
              Use Preview to open it as a learner would. Replacing it with another package clears where each learner had got to in this one; lessons already
              ticked off stay ticked off.
            </p>
          ) : (
            <p className="text-xs text-slate-500">This link is staff-only and expires in about an hour; learners get their own.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No {label} yet. The lesson cannot be published without one.</p>
      )}
      {canEdit && (
        <LessonFileUploader
          courseId={courseId}
          purpose={purpose}
          buttonLabel={file ? `Replace ${label}` : `Upload ${label}`}
          onUploaded={(uploaded, extra) =>
            attachLessonFile({ courseId, lessonId, fileToken: uploaded.fileToken, durationSeconds: extra.durationSeconds })
          }
        />
      )}
    </section>
  );
}
