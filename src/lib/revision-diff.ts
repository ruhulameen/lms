import { extractPlainText } from "@/lib/rich-text";

// What a post revision stores (see BlogPostRevision).
export type PostSnapshot = {
  title: string;
  slug: string;
  excerpt: string | null;
  body: unknown;
  seo: {
    title: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    noindex: boolean;
    socialImageId: number | null;
  } | null;
  categoryId: number | null;
  tagIds: number[];
};

export type DiffSegment = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 4_000_000;

// Word-level diff. Common start and end are trimmed first; the middle uses an
// LCS table unless it would be huge, then it is shown as one removal and one addition.
export function diffText(before: string, after: string): DiffSegment[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const out: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], word: string) => {
    const last = out.at(-1);
    if (last?.type === type) last.text += ` ${word}`;
    else out.push({ type, text: word });
  };

  a.slice(0, start).forEach((w) => push("same", w));
  if (midA.length * midB.length > MAX_CELLS) {
    midA.forEach((w) => push("del", w));
    midB.forEach((w) => push("add", w));
  } else {
    const rows = midA.length + 1;
    const cols = midB.length + 1;
    const lcs = new Uint32Array(rows * cols);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        lcs[i * cols + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * cols + j + 1] + 1
            : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        push("same", midA[i]);
        i++;
        j++;
      } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
        push("del", midA[i++]);
      } else {
        push("add", midB[j++]);
      }
    }
    while (i < midA.length) push("del", midA[i++]);
    while (j < midB.length) push("add", midB[j++]);
  }
  a.slice(endA).forEach((w) => push("same", w));
  return out;
}

export type FieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const show = (value: unknown) => (value === null || value === undefined || value === "" ? "(empty)" : String(value));

// Which fields differ between two snapshots. The body is compared as plain text.
export function diffSnapshots(before: PostSnapshot, after: PostSnapshot) {
  const pairs: [string, string, unknown, unknown][] = [
    ["title", "Title", before.title, after.title],
    ["slug", "Slug", before.slug, after.slug],
    ["excerpt", "Excerpt", before.excerpt, after.excerpt],
    ["seoTitle", "SEO title", before.seo?.title, after.seo?.title],
    ["metaDescription", "Meta description", before.seo?.metaDescription, after.seo?.metaDescription],
    ["canonicalUrl", "Canonical URL", before.seo?.canonicalUrl, after.seo?.canonicalUrl],
    ["noindex", "Hidden from search engines", before.seo?.noindex ?? false, after.seo?.noindex ?? false],
    ["socialImageId", "Social image (media id)", before.seo?.socialImageId, after.seo?.socialImageId],
    ["categoryId", "Category (id)", before.categoryId, after.categoryId],
    ["tagIds", "Tags (ids)", [...before.tagIds].sort().join(", "), [...after.tagIds].sort().join(", ")],
  ];
  const changes: FieldChange[] = pairs
    .filter(([, , x, y]) => show(x) !== show(y))
    .map(([field, label, x, y]) => ({ field, label, before: show(x), after: show(y) }));

  const bodyBefore = extractPlainText(before.body);
  const bodyAfter = extractPlainText(after.body);
  const body = bodyBefore === bodyAfter ? null : diffText(bodyBefore, bodyAfter);
  return { changes, body };
}
