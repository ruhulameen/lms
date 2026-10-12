"use client";

import { useRef, useState } from "react";
import { CircleAlert, Loader2, UploadCloud, X } from "lucide-react";
import { abortPrivateUpload, completePrivateUpload, signPrivateUploadParts, startPrivateUpload } from "@/actions/lesson-file";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActionResult } from "@/lib/action-result";
import {
  checkLessonFile,
  lessonFileAccept,
  lessonFileLimitsText,
  type LessonFilePurpose,
  type UploadedLessonFile,
} from "@/lib/lesson-file-types";
import { formatBytes } from "@/lib/media-types";
import { cn } from "@/lib/utils";

const PART_CONCURRENCY = 5;
const PART_RETRIES = 3;
const SIGN_BATCH = 10;

class UploadCancelled extends Error {}

type Phase = "idle" | "uploading" | "finishing" | "saving" | "error";

type LessonFileUploaderProps = {
  courseId: number;
  purpose: LessonFilePurpose;
  // Runs once the file is safely in storage: attach it with the matching server
  // action (attachLessonFile, addLessonResource, attachIntroVideo) and return its
  // result. `durationSeconds` is read from video files in the browser.
  onUploaded: (file: UploadedLessonFile, extra: { durationSeconds?: number }) => Promise<ActionResult>;
  // Text of the button that opens the file dialog.
  buttonLabel?: string;
  disabled?: boolean;
  className?: string;
};

// Reads how long a video is without uploading it. Resolves undefined when the
// browser cannot tell (unsupported codec, metadata after 8 seconds).
function readVideoDuration(file: File) {
  return new Promise<number | undefined>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (value: number | undefined) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };
    const timer = setTimeout(() => finish(undefined), 8000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : undefined);
    video.onerror = () => finish(undefined);
    video.src = url;
  });
}

// One file at a time, straight to the private bucket in parallel chunks, with
// progress and cancel. A failure (for example the bucket's CORS rule is not
// set) is shown with its reason and can be retried.
export function LessonFileUploader({ courseId, purpose, onUploaded, buttonLabel = "Choose file", disabled, className }: LessonFileUploaderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState("");
  const [size, setSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const run = useRef<{ cancelled: boolean; xhrs: Set<XMLHttpRequest>; token?: string } | null>(null);

  // Direct browser-to-R2 PUT: the one request that bypasses server actions.
  // XMLHttpRequest because fetch cannot report upload progress.
  function putBlob(state: { xhrs: Set<XMLHttpRequest> }, url: string, blob: Blob, contentType: string | null, onProgress: (loaded: number) => void) {
    return new Promise<string | null>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      state.xhrs.add(xhr);
      xhr.open("PUT", url);
      if (contentType) xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (event) => onProgress(event.loaded);
      xhr.onload = () => {
        state.xhrs.delete(xhr);
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader("ETag"));
        else reject(new Error(`Storage answered with status ${xhr.status}.`));
      };
      xhr.onerror = () => {
        state.xhrs.delete(xhr);
        reject(new Error("The connection to storage failed. If this keeps happening, the storage bucket may not allow uploads from this site yet (CORS)."));
      };
      xhr.onabort = () => {
        state.xhrs.delete(xhr);
        reject(new UploadCancelled());
      };
      xhr.send(blob);
    });
  }

  async function upload(file: File, state: NonNullable<typeof run.current>) {
    const check = () => {
      if (state.cancelled) throw new UploadCancelled();
    };
    const verdict = checkLessonFile(purpose, file);
    if (!verdict.ok) throw new Error(verdict.error);

    setPhase("uploading");
    setProgress(0);
    const durationPromise = verdict.kind === "VIDEO" ? readVideoDuration(file) : Promise.resolve(undefined);

    const started = await startPrivateUpload({ courseId, purpose, name: file.name, type: file.type, size: file.size });
    if (!started.ok) throw new Error(started.error);
    const upload = started.data;
    state.token = upload.token;
    check();

    let parts: { partNumber: number; etag: string }[] | undefined;
    if (upload.mode === "single") {
      await putBlob(state, upload.url, file, upload.contentType, (loaded) => setProgress(Math.round((loaded / file.size) * 100)));
    } else {
      const { partSize, partCount } = upload;
      const loadedByPart = new Array<number>(partCount + 1).fill(0);
      const etags = new Array<string>(partCount + 1);
      const report = () => setProgress(Math.min(99, Math.round((loadedByPart.reduce((sum, n) => sum + n, 0) / file.size) * 100)));

      // URLs are signed in small batches, when first needed.
      const urls = new Map<number, Promise<string>>();
      const sign = (from: number, fresh: boolean) => {
        const numbers: number[] = [];
        for (let n = from; n <= partCount && numbers.length < SIGN_BATCH; n++) {
          if (fresh ? n === from : !urls.has(n)) numbers.push(n);
        }
        const batch = signPrivateUploadParts({ token: upload.token, partNumbers: numbers }).then((result) => {
          if (!result.ok) throw new Error(result.error);
          return new Map(result.data.parts.map((p) => [p.partNumber, p.url]));
        });
        for (const n of numbers) urls.set(n, batch.then((map) => map.get(n)!));
      };

      let next = 1;
      const worker = async () => {
        while (next <= partCount) {
          check();
          const partNumber = next++;
          const blob = file.slice((partNumber - 1) * partSize, Math.min(partNumber * partSize, file.size));
          let attempt = 0;
          for (;;) {
            try {
              if (!urls.has(partNumber) || attempt > 0) sign(partNumber, attempt > 0);
              const url = await urls.get(partNumber)!;
              const etag = await putBlob(state, url, blob, null, (loaded) => {
                loadedByPart[partNumber] = loaded;
                report();
              });
              if (!etag) throw new Error("Storage did not return an ETag. Check the bucket CORS rule (pnpm storage:cors).");
              etags[partNumber] = etag;
              loadedByPart[partNumber] = blob.size;
              report();
              break;
            } catch (e) {
              loadedByPart[partNumber] = 0;
              if (e instanceof UploadCancelled || state.cancelled) throw new UploadCancelled();
              if (++attempt > PART_RETRIES) throw e;
              await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1) + Math.random() * 250));
            }
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, worker));
      parts = etags.map((etag, i) => ({ partNumber: i, etag })).filter((p) => p.partNumber > 0);
    }

    check();
    setPhase("finishing");
    setProgress(100);
    const done = await completePrivateUpload({ token: upload.token, parts });
    if (!done.ok) throw new Error(done.error);
    state.token = undefined;
    check();

    setPhase("saving");
    const saved = await onUploaded(done.data, { durationSeconds: await durationPromise });
    if (!saved.ok) {
      // The file is in storage but was not attached: release it.
      await abortPrivateUpload({ token: upload.token }).catch(() => {});
      throw new Error(saved.error);
    }
  }

  async function start(file: File) {
    const state = { cancelled: false, xhrs: new Set<XMLHttpRequest>(), token: undefined as string | undefined };
    run.current = state;
    setName(file.name);
    setSize(file.size);
    setError(null);
    try {
      await upload(file, state);
      setPhase("idle");
    } catch (e) {
      if (e instanceof UploadCancelled || state.cancelled) {
        setPhase("idle");
      } else {
        setError(e instanceof Error ? e.message : "The upload failed.");
        setPhase("error");
        // Release the server-side upload so nothing is left pending.
        if (state.token) await abortPrivateUpload({ token: state.token }).catch(() => {});
      }
    } finally {
      if (run.current === state) run.current = null;
    }
  }

  async function cancel() {
    const state = run.current;
    if (!state) return;
    state.cancelled = true;
    for (const xhr of state.xhrs) xhr.abort();
    if (state.token) await abortPrivateUpload({ token: state.token }).catch(() => {});
    setPhase("idle");
  }

  const busy = phase === "uploading" || phase === "finishing" || phase === "saving";

  return (
    <div className={cn("grid gap-2", className)}>
      {!busy && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && !disabled) void start(file);
          }}
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3",
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50",
          )}
        >
          <UploadCloud className="size-5 text-slate-500" aria-hidden />
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            {buttonLabel}
          </Button>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={lessonFileAccept(purpose)}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void start(file);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-slate-500">or drop it here. {lessonFileLimitsText(purpose)}</p>
        </div>
      )}

      {busy && (
        <div className="rounded-lg border bg-white p-3 text-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 shrink-0 animate-spin text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium" title={name}>
              {name}
            </span>
            <span className="shrink-0 text-xs text-slate-500">{formatBytes(size)}</span>
            {phase === "uploading" && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Cancel upload of ${name}`} onClick={cancel}>
                <X aria-hidden />
              </Button>
            )}
          </div>
          {phase !== "saving" && <Progress value={progress} aria-label={`Upload progress for ${name}`} className="mt-2" />}
          <p className="mt-1 text-xs text-slate-500">
            {phase === "uploading" && `${progress}%`}
            {phase === "finishing" && "Checking the file..."}
            {phase === "saving" && "Saving..."}
          </p>
        </div>
      )}

      {phase === "error" && error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
