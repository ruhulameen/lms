import { describe, expect, it } from "vitest";
import { checkFile, MB } from "@/lib/media-types";

describe("checkFile", () => {
  it("accepts an allowed image", () => {
    expect(checkFile({ name: "a.JPG", type: "image/jpeg", size: MB })).toMatchObject({ ok: true, kind: "IMAGE" });
  });
  it("rejects SVG and unknown types", () => {
    expect(checkFile({ name: "a.svg", type: "image/svg+xml", size: 100 }).ok).toBe(false);
    expect(checkFile({ name: "a.exe", type: "application/octet-stream", size: 100 }).ok).toBe(false);
  });
  it("rejects an extension that does not match the type", () => {
    expect(checkFile({ name: "a.png", type: "image/jpeg", size: 100 }).ok).toBe(false);
    expect(checkFile({ name: "noext", type: "image/png", size: 100 }).ok).toBe(false);
  });
  it("applies a size limit per kind", () => {
    expect(checkFile({ name: "a.png", type: "image/png", size: 26 * MB }).ok).toBe(false);
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 49 * MB }).ok).toBe(true);
    expect(checkFile({ name: "a.pdf", type: "application/pdf", size: 51 * MB }).ok).toBe(false);
    expect(checkFile({ name: "a.mp4", type: "video/mp4", size: 2048 * MB }).ok).toBe(true);
    expect(checkFile({ name: "a.mp4", type: "video/mp4", size: 2048 * MB + 1 }).ok).toBe(false);
  });
  it("rejects empty files", () => {
    expect(checkFile({ name: "a.txt", type: "text/plain", size: 0 }).ok).toBe(false);
  });
});
