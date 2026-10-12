"use client";

import { Trash2 } from "lucide-react";
import { attachIntroVideo, removeIntroVideo } from "@/actions/course";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { LessonFileUploader } from "@/components/admin/lesson-file-uploader";
import { formatBytes } from "@/lib/media-types";

type CourseIntroVideoProps = {
  courseId: number;
  video: { name: string; size: number } | null;
  // Signed link from getCourseIntroVideoUrl(), for the staff preview.
  previewUrl: string | null;
  canEdit: boolean;
};

// Optional promo video for the course page, stored in the private bucket.
// Uploading and removing save at once. Lives outside the course form, so its
// dialogs never sit inside another <form>.
export function CourseIntroVideo({ courseId, video, previewUrl, canEdit }: CourseIntroVideoProps) {
  return (
    <section aria-label="Intro video" className="grid max-w-3xl gap-3 rounded-xl border bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Intro video</h2>
      <p className="-mt-2 text-xs text-slate-500">Optional. A short promo anyone can watch on the course page once it is published.</p>
      {video ? (
        <div className="grid gap-3">
          {previewUrl && <video controls preload="metadata" src={previewUrl} className="aspect-video w-full max-w-2xl rounded-lg bg-black" aria-label="Intro video preview" />}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium" title={video.name}>
              {video.name}
            </span>
            <span className="text-xs text-slate-500">{formatBytes(video.size)}</span>
            {canEdit && (
              <ConfirmDialog
                action={async () => removeIntroVideo({ courseId })}
                title="Remove the intro video?"
                description="The file is deleted from storage."
                trigger={<><Trash2 aria-hidden /> Remove</>}
                triggerVariant="ghost"
                triggerLabel="Remove the intro video"
                confirmLabel="Remove video"
                destructive
              />
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No intro video.</p>
      )}
      {canEdit && (
        <LessonFileUploader
          courseId={courseId}
          purpose="intro-video"
          buttonLabel={video ? "Replace video" : "Upload video"}
          onUploaded={(uploaded) => attachIntroVideo({ courseId, fileToken: uploaded.fileToken })}
        />
      )}
    </section>
  );
}
