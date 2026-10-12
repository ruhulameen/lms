"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/slug";

type TagOption = { id: number; name: string };

type TagInputProps = {
  options: TagOption[];
  // Ids of the tags the post has.
  initialIds: number[];
  // New names typed before an error, so they survive a failed save.
  initialNew?: string[];
  // Creating a tag needs blog-taxonomy.manage; without it only existing tags can be picked.
  canCreate: boolean;
  disabled?: boolean;
  error?: string[];
};

// Picks existing tags and, when allowed, creates new ones by typing. Submits
// `tagIds` (one per existing tag) and `newTags` (one per new name).
export function TagInput({ options, initialIds, initialNew = [], canCreate, disabled, error }: TagInputProps) {
  const [ids, setIds] = useState<number[]>(initialIds);
  const [newNames, setNewNames] = useState<string[]>(initialNew);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const listId = useId();
  const byId = new Map(options.map((o) => [o.id, o.name]));
  const query = text.trim().toLowerCase();
  const suggestions = options
    .filter((o) => !ids.includes(o.id) && (!query || o.name.toLowerCase().includes(query)))
    .slice(0, 8);

  function commit(raw: string) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) return;
    setNotice(null);
    const slug = slugify(name);
    const match = options.find((o) => slugify(o.name) === slug);
    if (match) {
      setIds((current) => (current.includes(match.id) ? current : [...current, match.id]));
    } else if (!slug) {
      setNotice("Use letters or numbers in a tag name.");
      return;
    } else if (!canCreate) {
      setNotice("You can only pick existing tags. Ask someone who manages categories and tags to add new ones.");
      return;
    } else if (!newNames.some((n) => slugify(n) === slug)) {
      setNewNames((current) => [...current, name]);
    }
    setText("");
  }

  return (
    <div className="grid gap-2">
      {ids.map((id) => (
        <input key={`id-${id}`} type="hidden" name="tagIds" value={id} />
      ))}
      {newNames.map((name) => (
        <input key={`new-${name}`} type="hidden" name="newTags" value={name} />
      ))}

      {(ids.length > 0 || newNames.length > 0) && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {ids.map((id) => (
            <Chip key={`id-${id}`} label={byId.get(id) ?? `Tag ${id}`} disabled={disabled} onRemove={() => setIds((c) => c.filter((x) => x !== id))} />
          ))}
          {newNames.map((name) => (
            <Chip key={`new-${name}`} label={name} isNew disabled={disabled} onRemove={() => setNewNames((c) => c.filter((x) => x !== name))} />
          ))}
        </ul>
      )}

      <Input
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          setNotice(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(text);
          } else if (e.key === "Backspace" && !text) {
            setNewNames((c) => c.slice(0, -1));
          }
        }}
        placeholder={canCreate ? "Type a tag and press Enter" : "Search tags"}
        aria-label="Add a tag"
        aria-describedby={listId}
        autoComplete="off"
        aria-invalid={Boolean(error?.[0])}
      />
      {suggestions.length > 0 && !disabled && (
        <ul id={listId} aria-label="Existing tags" className="flex flex-wrap gap-1.5">
          {suggestions.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  setIds((c) => [...c, o.id]);
                  setText("");
                }}
                className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-700"
              >
                + {o.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(notice || error?.[0]) && (
        <p role="alert" className="text-sm text-destructive">
          {notice ?? error?.[0]}
        </p>
      )}
    </div>
  );
}

function Chip({ label, isNew, disabled, onRemove }: { label: string; isNew?: boolean; disabled?: boolean; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded-full bg-blue-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-blue-800">
      {label}
      {isNew && <span className="text-[10px] text-blue-600">(new)</span>}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="rounded-full p-0.5 hover:bg-blue-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </li>
  );
}
