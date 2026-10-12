import { z } from "zod";
import { unsplash } from "@/lib/format";

// Block format of the old sample posts; only blocksToDocument reads it (seed).
export type PostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string }
  | { type: "image"; image: string }
  | { type: "list"; items: string[] };

// The stored document is Tiptap/ProseMirror JSON. Everything coming from a
// browser goes through richTextSchema, which keeps only the nodes, marks and
// attributes below, so the renderer never meets anything else.
export type RichTextMark = { type: string; attrs?: Record<string, unknown> };
export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
};
export type RichTextDocument = RichTextNode & { type: "doc"; content: RichTextNode[] };

export const MAX_DOCUMENT_BYTES = 500_000;
const MAX_DEPTH = 12;
const MAX_NODES = 20_000;

export const emptyDocument: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function emptyDocumentCopy(): RichTextDocument {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

// Nodes that hold other blocks, versus ones that hold inline text.
const BLOCK_CONTAINERS = new Set(["doc", "blockquote", "bulletList", "orderedList", "listItem"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
const NODES = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
  "text",
]);

// http(s), mailto, tel and site-relative paths only.
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || url.length > 2048 || /[\u0000-\u001f\s]/.test(url)) return false;
  if (url.startsWith("//")) return false;
  if (url.startsWith("/") || url.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function cleanString(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

function cleanDimension(value: unknown) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 20_000 ? n : undefined;
}

function cleanMarks(raw: unknown): RichTextMark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const marks: RichTextMark[] = [];
  for (const mark of raw) {
    if (!mark || typeof mark !== "object") continue;
    const { type, attrs } = mark as { type?: unknown; attrs?: Record<string, unknown> };
    if (typeof type !== "string" || !MARKS.has(type)) continue;
    if (type === "link") {
      // A link with an unsafe URL is dropped; its text stays.
      if (!isSafeUrl(attrs?.href)) continue;
      marks.push({ type, attrs: { href: (attrs!.href as string).trim() } });
    } else {
      marks.push({ type });
    }
  }
  return marks.length ? marks : undefined;
}

type Counter = { nodes: number };

function cleanNode(raw: unknown, depth: number, counter: Counter): RichTextNode | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Malformed node.");
  if (depth > MAX_DEPTH) throw new Error("Document is nested too deeply.");
  if (++counter.nodes > MAX_NODES) throw new Error("Document has too many nodes.");

  const node = raw as { type?: unknown; attrs?: Record<string, unknown>; content?: unknown; text?: unknown };
  if (typeof node.type !== "string") throw new Error("Malformed node.");
  // Unknown node types are ignored, not fatal.
  if (!NODES.has(node.type)) return null;

  const out: RichTextNode = { type: node.type };
  const attrs = node.attrs ?? {};

  switch (node.type) {
    case "text": {
      const text = cleanString(node.text, 100_000);
      if (!text) return null;
      out.text = text;
      out.marks = cleanMarks((raw as { marks?: unknown }).marks);
      if (!out.marks) delete out.marks;
      return out;
    }
    case "heading": {
      const level = Number(attrs.level);
      out.attrs = { level: level >= 2 && level <= 4 ? level : level < 2 ? 2 : 4 };
      break;
    }
    case "orderedList": {
      const start = Number(attrs.start);
      out.attrs = { start: Number.isInteger(start) && start > 0 && start < 100_000 ? start : 1 };
      break;
    }
    case "codeBlock": {
      const language = cleanString(attrs.language, 30);
      if (language && /^[a-z0-9+#-]+$/i.test(language)) out.attrs = { language };
      break;
    }
    case "image": {
      const src = attrs.src;
      if (!isSafeUrl(src) || /^(mailto|tel):/i.test(src)) return null;
      const mediaId = cleanDimension(attrs.mediaId);
      out.attrs = {
        src: src.trim(),
        alt: cleanString(attrs.alt, 500) ?? "",
        ...(mediaId && { mediaId }),
        ...(cleanDimension(attrs.width) && { width: cleanDimension(attrs.width) }),
        ...(cleanDimension(attrs.height) && { height: cleanDimension(attrs.height) }),
      };
      return out;
    }
  }

  if (node.content !== undefined) {
    if (!Array.isArray(node.content)) throw new Error("Malformed node.");
    const children: RichTextNode[] = [];
    for (const child of node.content) {
      const cleaned = cleanNode(child, depth + 1, counter);
      if (!cleaned || cleaned.type === "doc") continue;
      // Keep the tree valid: containers hold blocks, textblocks hold inline nodes.
      const inline = cleaned.type === "text" || cleaned.type === "hardBreak";
      if (BLOCK_CONTAINERS.has(node.type) ? inline : !inline) continue;
      if (node.type === "doc" || node.type === "blockquote" || node.type === "listItem") {
        if (cleaned.type === "listItem") continue;
      } else if (node.type === "bulletList" || node.type === "orderedList") {
        if (cleaned.type !== "listItem") continue;
      }
      children.push(cleaned);
    }
    if (children.length) out.content = children;
  }
  return out;
}

// Returns a clean document, or throws on malformed or oversized input.
export function sanitizeDocument(input: unknown): RichTextDocument {
  const text = JSON.stringify(input);
  if (!text || text.length > MAX_DOCUMENT_BYTES) throw new Error("The content is too large.");
  if (!input || typeof input !== "object" || (input as { type?: unknown }).type !== "doc") {
    throw new Error("Malformed document.");
  }
  const cleaned = cleanNode(input, 0, { nodes: 0 });
  if (!cleaned) throw new Error("Malformed document.");
  return { type: "doc", content: cleaned.content?.length ? cleaned.content : [{ type: "paragraph" }] };
}

// Accepts the document object or the JSON string a hidden form input carries.
export const richTextSchema = z.unknown().transform((value, ctx): RichTextDocument => {
  let parsed = value;
  if (typeof value === "string") {
    if (value.length > MAX_DOCUMENT_BYTES) {
      ctx.addIssue({ code: "custom", message: "The content is too large." });
      return z.NEVER;
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "The content is not valid." });
      return z.NEVER;
    }
  }
  try {
    return sanitizeDocument(parsed);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "The content is not valid." });
    return z.NEVER;
  }
});

function collectText(node: RichTextNode, out: string[]) {
  if (node.type === "text") {
    out.push(node.text ?? "");
    return;
  }
  if (node.type === "hardBreak") {
    out.push(" ");
    return;
  }
  for (const child of node.content ?? []) collectText(child, out);
  // Block boundary, so words from neighbouring paragraphs do not run together.
  if (node.type !== "doc" && !["text", "image"].includes(node.type)) out.push(" ");
}

// Readable text without markup, for excerpts, search and word counts.
export function extractPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const parts: string[] = [];
  collectText(doc as RichTextNode, parts);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function wordCount(doc: unknown) {
  const text = extractPlainText(doc);
  return text ? text.split(" ").length : 0;
}

// About 200 words a minute, never less than one.
export function readingTimeMinutes(doc: unknown) {
  return Math.max(1, Math.ceil(wordCount(doc) / 200));
}

export function excerptFromDocument(doc: unknown, maxLength = 160) {
  const text = extractPlainText(doc);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function isEmptyDocument(doc: unknown) {
  if (extractPlainText(doc)) return false;
  const hasImage = (n: RichTextNode): boolean =>
    n.type === "image" || n.type === "horizontalRule" || (n.content ?? []).some(hasImage);
  return !hasImage(doc as RichTextNode);
}

const text = (value: string): RichTextNode[] => (value ? [{ type: "text", text: value }] : []);

// Converts the sample posts' old block format to an editor document.
export function blocksToDocument(blocks: PostBlock[]): RichTextDocument {
  const content: RichTextNode[] = blocks.map((block): RichTextNode => {
    switch (block.type) {
      case "heading":
        return { type: "heading", attrs: { level: 2 }, content: text(block.text) };
      case "quote":
        return {
          type: "blockquote",
          content: [{ type: "paragraph", content: text(block.text) }],
        };
      case "image":
        return {
          type: "image",
          attrs: { src: unsplash(block.image, 1200), alt: "", width: 1200, height: 675 },
        };
      case "list":
        return {
          type: "bulletList",
          content: block.items.map((item) => ({
            type: "listItem",
            content: [{ type: "paragraph", content: text(item) }],
          })),
        };
      default:
        return { type: "paragraph", content: text(block.text) };
    }
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
