import { describe, expect, it } from "vitest";
import { nextFreeSlug, slugify, validateSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, strips accents and joins words", () => {
    expect(slugify("  Café & Crème: 10 Tips!  ")).toBe("cafe-and-creme-10-tips");
  });
  it("returns an empty string when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("validateSlug", () => {
  it("accepts clean slugs", () => {
    expect(validateSlug("my-post-2")).toBeNull();
  });
  it("rejects empty, uppercase and doubled hyphens", () => {
    expect(validateSlug("")).not.toBeNull();
    expect(validateSlug("My-Post")).not.toBeNull();
    expect(validateSlug("a--b")).not.toBeNull();
  });
});

describe("nextFreeSlug", () => {
  it("appends a number until the slug is free", async () => {
    const taken = new Set(["hello", "hello-2"]);
    expect(await nextFreeSlug("Hello", (s) => taken.has(s))).toBe("hello-3");
  });
  it("falls back to untitled", async () => {
    expect(await nextFreeSlug("???", () => false)).toBe("untitled");
  });
});
