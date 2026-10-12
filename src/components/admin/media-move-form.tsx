"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { moveMedia } from "@/actions/media";
import { selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type MediaMoveFormProps = {
  mediaId: number;
  folderId: number | null;
  folders: { id: number; label: string }[];
};

export function MediaMoveForm({ mediaId, folderId, folders }: MediaMoveFormProps) {
  const [pending, startTransition] = useTransition();

  function run(formData: FormData) {
    startTransition(async () => {
      const result = await moveMedia(formData);
      if (result.ok) toast.success(result.message ?? "Moved.");
      else toast.error(result.error);
    });
  }

  return (
    <form action={run} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={mediaId} />
      <div className="grid gap-1.5">
        <Label htmlFor="media-folder">Folder</Label>
        <select id="media-folder" name="folderId" defaultValue={folderId ?? ""} className={selectClassName}>
          <option value="">Top level</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Moving..." : "Move"}
      </Button>
    </form>
  );
}
