import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/site/rich-text";
import {
  blocksToDocument,
  extractPlainText,
  readingTimeMinutes,
  richTextSchema,
  wordCount,
} from "@/lib/rich-text";

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hello" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Visit " },
        { type: "text", text: "us", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
        { type: "text", text: " now", marks: [{ type: "bold" }] },
      ],
    },
  ],
};

describe("richTextSchema", () => {
  it("accepts a document or its JSON string", () => {
    expect(richTextSchema.safeParse(doc).success).toBe(true);
    expect(richTextSchema.safeParse(JSON.stringify(doc)).success).toBe(true);
  });
  it("rejects malformed and oversized input", () => {
    expect(richTextSchema.safeParse("{nope").success).toBe(false);
    expect(richTextSchema.safeParse({ type: "paragraph" }).success).toBe(false);
    expect(richTextSchema.safeParse({ type: "doc", content: ["x"] }).success).toBe(false);
    const big = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(600_000) }] }] };
    expect(richTextSchema.safeParse(big).success).toBe(false);
  });
  it("drops unknown nodes and unsafe links", () => {
    const result = richTextSchema.parse({
      type: "doc",
      content: [
        { type: "script", content: [] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("javascript");
    expect(JSON.stringify(result)).not.toContain("script");
  });
});

describe("plain text", () => {
  it("extracts text with block spacing", () => {
    expect(extractPlainText(doc)).toBe("Hello Visit us now");
    expect(wordCount(doc)).toBe(4);
    expect(readingTimeMinutes(doc)).toBe(1);
  });
});

describe("blocksToDocument", () => {
  it("converts the old block format", () => {
    const converted = blocksToDocument([
      { type: "heading", text: "Title" },
      { type: "paragraph", text: "Body" },
      { type: "quote", text: "Quote" },
      { type: "list", items: ["a", "b"] },
      { type: "image", image: "photo-1" },
    ]);
    expect(converted.content.map((n) => n.type)).toEqual(["heading", "paragraph", "blockquote", "bulletList", "image"]);
    expect(richTextSchema.safeParse(converted).success).toBe(true);
    expect(extractPlainText(converted)).toBe("Title Body Quote a b");
  });
});

describe("RichText renderer", () => {
  it("renders elements and safe links without raw HTML", () => {
    const html = renderToStaticMarkup(createElement(RichText, { doc }));
    expect(html).toContain("<h2>Hello</h2>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<strong>");
  });
  it("skips unknown nodes and unsafe hrefs", () => {
    const html = renderToStaticMarkup(
      createElement(RichText, {
        doc: {
          type: "doc",
          content: [
            { type: "mystery", content: [{ type: "text", text: "hidden" }] },
            { type: "paragraph", content: [{ type: "text", text: "ok", marks: [{ type: "link", attrs: { href: "javascript:x" } }] }] },
          ],
        },
      }),
    );
    expect(html).not.toContain("hidden");
    expect(html).not.toContain("javascript");
    expect(html).toContain("ok");
  });
});
