"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

type PickerOption = { id: number; label: string };

type CouponPickerProps = {
  // Submitted as one `name` value per ticked option.
  name: string;
  label: string;
  options: PickerOption[];
  initialIds: number[];
  // Said when nothing is ticked.
  noneText: string;
  noun: { one: string; many: string };
  disabled?: boolean;
};

// A searchable list of tick boxes. Options that do not match the search are
// hidden, not removed, so ticks survive while searching and submit as usual.
export function CouponPicker({ name, label, options, initialIds, noneText, noun, disabled }: CouponPickerProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialIds));
  const [query, setQuery] = useState("");
  const inputId = useId();
  const needle = query.trim().toLowerCase();
  const visible = options.filter((o) => !needle || o.label.toLowerCase().includes(needle));

  function toggle(id: number, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-2">
      <legend className="text-sm leading-none font-medium">{label}</legend>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span aria-live="polite">{selected.size === 0 ? noneText : `${selected.size} ${selected.size === 1 ? noun.one : noun.many} chosen`}</span>
        {selected.size > 0 && (
          <button type="button" onClick={() => setSelected(new Set())} className="font-medium text-blue-700 hover:underline">
            Clear
          </button>
        )}
      </div>
      <Input
        type="search"
        id={inputId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${noun.many}`}
        aria-label={`Search ${noun.many}`}
        autoComplete="off"
      />
      <ul className="max-h-56 overflow-y-auto rounded-lg border bg-white">
        {options.map((option) => (
          <li key={option.id} hidden={!visible.includes(option)}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                name={name}
                value={option.id}
                checked={selected.has(option.id)}
                onChange={(e) => toggle(option.id, e.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          </li>
        ))}
        {visible.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No {noun.many} match your search.</li>}
      </ul>
    </fieldset>
  );
}
