"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { emptyDocumentCopy, type RichTextDocument } from "@/lib/rich-text";

// Tiptap is loaded on demand, so it is not part of the admin shell's bundle.
const TiptapEditor = dynamic(() => import("@/components/admin/tiptap-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-64 animate-pulse rounded-lg border bg-slate-50" role="status" aria-label="Loading editor" />
  ),
});

type RichTextEditorProps = {
  // Hidden input name; the document is submitted as JSON under it.
  name: string;
  label: string;
  initialValue?: RichTextDocument | null;
  error?: string[];
};

// Use inside an ordinary <form action={serverAction}>; parse the field on the
// server with richTextSchema from "@/lib/rich-text".
export function RichTextEditor({ name, label, initialValue, error }: RichTextEditorProps) {
  const [doc, setDoc] = useState<RichTextDocument>(initialValue ?? emptyDocumentCopy());
  const id = `${name}-editor`;
  const message = error?.[0];
  return (
    <div className="grid gap-1.5">
      <span id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
      </span>
      <input type="hidden" name={name} value={JSON.stringify(doc)} />
      <TiptapEditor
        initial={doc}
        onChange={setDoc}
        labelledBy={`${id}-label`}
        invalid={Boolean(message)}
      />
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
