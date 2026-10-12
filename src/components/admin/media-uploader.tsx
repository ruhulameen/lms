"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Loader2, UploadCloud, X } from "lucide-react";
import { abortUpload, completeUpload, signUploadParts, startUpload } from "@/actions/media";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  acceptAttribute,
  checkFile,
  formatBytes,
  uploadLimitsText,
  type MediaKindValue,
  type MediaSummary,
} from "@/lib/media-types";
import { cn } from "@/lib/utils";

const PART_CONCURRENCY = 5;
const FILE_CONCURRENCY = 2;
const PART_RETRIES = 3;
const SIGN_BATCH = 10;

type Phase = "queued" | "uploading" | "finishing" | "done" | "error" | "cancelled";

type Item = {
  id: string;
  name: string;
  size: number;
  phase: Phase;
  progress: number;
  error?: string;
};

class UploadCancelled extends Error {}

type MediaUploaderProps = {
  // Folder new files go into (null = top level).
  folderId: number | null;
  // Called once a batch finishes with the files that uploaded. Without it the
  // page is refreshed so the library shows them.
  onUploaded?: (items: MediaSummary[]) => void;
  // Limits what the file dialog suggests; the server still decides.
  accept?: MediaKindValue;
  className?: string;
};

export function MediaUploader({ folderId, onUploaded, accept, className }: MediaUploaderProps) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, { cancelled: boolean; xhrs: Set<XMLHttpRequest>; mediaId?: number }>());
  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const finished = useRef<MediaSummary[]>([]);
  const folderRef = useRef(folderId);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    folderRef.current = folderId;
    onUploadedRef.current = onUploaded;
  });

  const patch = useCallback((id: string, changes: Partial<Item>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  // PUT one blob to a presigned URL. This direct browser-to-R2 request is the
  // deliberate exception to "no browser requests outside server actions".
  // XMLHttpRequest because fetch cannot report upload progress.
  const putBlob = useCallback(
    (
      state: { xhrs: Set<XMLHttpRequest> },
      url: string,
      blob: Blob,
      contentType: string | null,
      onProgress: (loaded: number) => void,
    ) =>
      new Promise<string | null>((resolve, reject) => {
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
          reject(new Error("The connection to storage failed."));
        };
        xhr.onabort = () => {
          state.xhrs.delete(xhr);
          reject(new UploadCancelled());
        };
        xhr.send(blob);
      }),
    [],
  );

  const uploadOne = useCallback(
    async (id: string) => {
      const file = files.current.get(id)!;
      const state = controllers.current.get(id)!;
      const check = () => {
        if (state.cancelled) throw new UploadCancelled();
      };

      patch(id, { phase: "uploading", progress: 0 });
      const started = await startUpload({
        name: file.name,
        type: file.type,
        size: file.size,
        folderId: folderRef.current,
      });
      if (!started.ok) throw new Error(started.error);
      const upload = started.data;
      state.mediaId = upload.mediaId;
      check();

      let parts: { partNumber: number; etag: string }[] | undefined;

      if (upload.mode === "single") {
        await putBlob(state, upload.url, file, upload.contentType, (loaded) =>
          patch(id, { progress: Math.round((loaded / file.size) * 100) }),
        );
      } else {
        const { partSize, partCount } = upload;
        const loadedByPart = new Array<number>(partCount + 1).fill(0);
        const etags = new Array<string>(partCount + 1);
        const reportProgress = () => {
          const loaded = loadedByPart.reduce((sum, n) => sum + n, 0);
          patch(id, { progress: Math.min(99, Math.round((loaded / file.size) * 100)) });
        };

        // URLs are signed in small batches, when first needed.
        const urls = new Map<number, Promise<string>>();
        const sign = (from: number, fresh: boolean) => {
          const numbers: number[] = [];
          for (let n = from; n <= partCount && numbers.length < SIGN_BATCH; n++) {
            if (fresh ? n === from : !urls.has(n)) numbers.push(n);
          }
          const batch = signUploadParts({ mediaId: upload.mediaId, partNumbers: numbers }).then((result) => {
            if (!result.ok) throw new Error(result.error);
            return new Map(result.data.parts.map((p) => [p.partNumber, p.url]));
          });
          for (const n of numbers) {
            urls.set(n, batch.then((map) => map.get(n)!));
          }
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
                  reportProgress();
                });
                if (!etag) throw new Error("Storage did not return an ETag. Check the bucket CORS rule (pnpm storage:cors).");
                etags[partNumber] = etag;
                loadedByPart[partNumber] = blob.size;
                reportProgress();
                break;
              } catch (error) {
                loadedByPart[partNumber] = 0;
                if (error instanceof UploadCancelled || state.cancelled) throw new UploadCancelled();
                if (++attempt > PART_RETRIES) throw error;
                await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1) + Math.random() * 250));
              }
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, partCount) }, worker));
        parts = etags.map((etag, i) => ({ partNumber: i, etag })).filter((p) => p.partNumber > 0);
      }

      check();
      patch(id, { phase: "finishing", progress: 100 });
      const done = await completeUpload({ mediaId: upload.mediaId, parts });
      if (!done.ok) throw new Error(done.error);
      finished.current.push(done.data);
      patch(id, { phase: "done" });
    },
    [patch, putBlob],
  );

  const pump = useCallback(() => {
    while (running.current < FILE_CONCURRENCY && queue.current.length > 0) {
      const id = queue.current.shift()!;
      const state = controllers.current.get(id);
      if (!state || state.cancelled) continue;
      running.current++;
      uploadOne(id)
        .catch(async (error) => {
          if (error instanceof UploadCancelled || state.cancelled) {
            patch(id, { phase: "cancelled" });
          } else {
            patch(id, { phase: "error", error: error instanceof Error ? error.message : "The upload failed." });
            // Release the server-side upload so nothing is left pending.
            if (state.mediaId) await abortUpload({ mediaId: state.mediaId }).catch(() => {});
          }
        })
        .finally(() => {
          running.current--;
          if (running.current === 0 && queue.current.length === 0 && finished.current.length > 0) {
            const batch = finished.current;
            finished.current = [];
            if (onUploadedRef.current) onUploadedRef.current(batch);
            else router.refresh();
          }
          pump();
        });
    }
  }, [patch, router, uploadOne]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const added: Item[] = [];
      for (const file of Array.from(list)) {
        const id = crypto.randomUUID();
        const result = checkFile(file);
        if (!result.ok) {
          added.push({ id, name: file.name, size: file.size, phase: "error", progress: 0, error: result.error });
          continue;
        }
        files.current.set(id, file);
        controllers.current.set(id, { cancelled: false, xhrs: new Set() });
        queue.current.push(id);
        added.push({ id, name: file.name, size: file.size, phase: "queued", progress: 0 });
      }
      setItems((list) => [...list, ...added]);
      pump();
    },
    [pump],
  );

  async function cancel(id: string) {
    const state = controllers.current.get(id);
    if (!state) return;
    state.cancelled = true;
    for (const xhr of state.xhrs) xhr.abort();
    patch(id, { phase: "cancelled" });
    if (state.mediaId) await abortUpload({ mediaId: state.mediaId }).catch(() => {});
  }

  function dismiss(id: string) {
    files.current.delete(id);
    controllers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  const active = items.filter((i) => i.phase === "queued" || i.phase === "uploading" || i.phase === "finishing").length;
  const done = items.filter((i) => i.phase === "done").length;
  const failed = items.filter((i) => i.phase === "error").length;
  const summary =
    items.length === 0
      ? ""
      : active > 0
        ? `Uploading ${active} ${active === 1 ? "file" : "files"}. ${done} finished.`
        : `Upload finished: ${done} uploaded${failed ? `, ${failed} failed` : ""}.`;

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50",
        )}
      >
        <UploadCloud className="size-6 text-slate-500" aria-hidden />
        <p className="text-sm text-slate-700">Drag files here, or</p>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={accept === "IMAGE" ? "image/jpeg,image/png,image/webp,image/avif,image/gif" : acceptAttribute}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-slate-500">{uploadLimitsText}</p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {summary}
      </p>

      {items.length > 0 && (
        <ul className="grid gap-2" aria-label="Uploads">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-white p-3 text-sm">
              <div className="flex items-center gap-2">
                <PhaseIcon phase={item.phase} />
                <span className="min-w-0 flex-1 truncate font-medium" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(item.size)}</span>
                {item.phase === "queued" || item.phase === "uploading" ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Cancel upload of ${item.name}`} onClick={() => cancel(item.id)}>
                    <X aria-hidden />
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Dismiss ${item.name}`} onClick={() => dismiss(item.id)}>
                    <X aria-hidden />
                  </Button>
                )}
              </div>
              {(item.phase === "uploading" || item.phase === "finishing") && (
                <Progress value={item.progress} aria-label={`Upload progress for ${item.name}`} className="mt-2" />
              )}
              <p className={cn("mt-1 text-xs", item.phase === "error" ? "text-destructive" : "text-slate-500")}>
                {item.phase === "queued" && "Waiting to start"}
                {item.phase === "uploading" && `${item.progress}%`}
                {item.phase === "finishing" && "Checking the file..."}
                {item.phase === "done" && "Uploaded"}
                {item.phase === "cancelled" && "Cancelled"}
                {item.phase === "error" && item.error}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhaseIcon({ phase }: { phase: Phase }) {
  if (phase === "done") return <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden />;
  if (phase === "error") return <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />;
  if (phase === "cancelled") return <X className="size-4 shrink-0 text-slate-400" aria-hidden />;
  return <Loader2 className={cn("size-4 shrink-0 text-slate-500", phase !== "queued" && "animate-spin")} aria-hidden />;
}
