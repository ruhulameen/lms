"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Folder, Search } from "lucide-react";
import { loadPickerPage, type PickerPage } from "@/actions/media";
import { MediaThumb } from "@/components/admin/media-thumb";
import { MediaUploader } from "@/components/admin/media-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatBytes, mediaKindLabels, type MediaKindValue, type MediaSummary } from "@/lib/media-types";

type MediaPickerProps = {
  onSelect: (media: MediaSummary) => void;
  // Only show this kind of file, e.g. "IMAGE".
  kind?: MediaKindValue;
  trigger: ReactNode;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
};

// The dialog loads each page of results through the loadPickerPage server
// action (called from the browser, no API route) when it opens or the user
// searches, browses folders or pages. Nothing is loaded while it is closed, so
// forms that include a picker stay light.
export function MediaPicker({ onSelect, kind, trigger, triggerLabel, triggerVariant = "outline" }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PickerPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [pending, startTransition] = useTransition();
  const query = useRef({ search: "", folderId: null as number | null, page: 1 });

  function load(changes: Partial<typeof query.current>) {
    query.current = { ...query.current, ...changes };
    startTransition(async () => {
      const result = await loadPickerPage({
        search: query.current.search || undefined,
        kind,
        folderId: query.current.folderId,
        page: query.current.page,
      });
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setShowUpload(false);
      load({ search: "", folderId: null, page: 1 });
      setSearch("");
    }
  }

  function choose(media: MediaSummary) {
    onSelect(media);
    setOpen(false);
  }

  const currentFolder = data?.path.at(-1)?.id ?? null;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const noun = kind ? mediaKindLabels[kind].toLowerCase() : "file";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant={triggerVariant} size="sm" aria-label={triggerLabel} />}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose {noun === "file" ? "a file" : `an ${noun}`}</DialogTitle>
          <DialogDescription>Search the library, open a folder, or upload a new file.</DialogDescription>
        </DialogHeader>

        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load({ search: search.trim(), page: 1 });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, title or alt text"
              aria-label="Search media"
              className="pl-8"
            />
          </div>
          <Button type="submit" disabled={pending}>Search</Button>
          {data?.uploadEnabled && (
            <Button type="button" variant="outline" aria-expanded={showUpload} onClick={() => setShowUpload((v) => !v)}>
              Upload
            </Button>
          )}
        </form>

        {showUpload && data?.uploadEnabled && (
          <MediaUploader
            folderId={currentFolder}
            accept={kind}
            onUploaded={(items) => {
              if (items.length === 1) choose(items[0]);
              else load({ page: 1 });
            }}
          />
        )}

        <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => load({ folderId: null, page: 1, search: "" })}>
            All media
          </Button>
          {data?.path.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => load({ folderId: crumb.id, page: 1, search: "" })}>
                {crumb.name}
              </Button>
            </span>
          ))}
        </nav>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div aria-busy={pending} className={pending ? "opacity-60" : undefined}>
          {data && data.folders.length > 0 && (
            <ul aria-label="Folders" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => load({ folderId: f.id, page: 1, search: "" })}
                    className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Folder className="size-4 shrink-0 text-blue-600" aria-hidden />
                    <span className="truncate">{f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {data && data.items.length === 0 && !pending && (
            <p className="py-8 text-center text-sm text-slate-500">No {noun === "file" ? "files" : `${noun}s`} found.</p>
          )}
          {!data && !error && <p className="py-8 text-center text-sm text-slate-500">Loading...</p>}

          {data && data.items.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {data.items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => choose(m)}
                    aria-label={`Select ${m.title || m.filename}, ${formatBytes(m.size)}`}
                    className="group block w-full overflow-hidden rounded-lg border text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="relative block aspect-square bg-slate-100">
                      <MediaThumb media={m} sizes="120px" />
                    </span>
                    <span className="block truncate p-1.5 text-xs group-hover:underline">{m.title || m.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && pages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <Button type="button" variant="outline" size="sm" disabled={pending || data.page <= 1} onClick={() => load({ page: data.page - 1 })}>
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <span>Page {data.page} of {pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={pending || data.page >= pages} onClick={() => load({ page: data.page + 1 })}>
              Next <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
