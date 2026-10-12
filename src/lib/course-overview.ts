import { extractPlainText, isEmptyDocument, type RichTextDocument } from "@/lib/rich-text";

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

// The course description without its first paragraph when that paragraph just
// repeats the short description shown above it as the lead. Null when nothing
// is left to show. Anything else is returned unchanged.
export function descriptionBelowLead(description: unknown, lead: string | null): unknown {
  if (description == null || isEmptyDocument(description)) return null;
  if (!lead) return description;
  const doc = description as RichTextDocument;
  const first = doc.content?.[0];
  if (first?.type === "paragraph" && squash(extractPlainText(first)) === squash(lead)) {
    const rest = { ...doc, content: doc.content.slice(1) };
    return isEmptyDocument(rest) ? null : rest;
  }
  return description;
}
