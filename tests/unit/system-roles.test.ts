import { describe, expect, it } from "vitest";
import { isSystemRole } from "@/lib/roles";

describe("isSystemRole", () => {
  it("is true for student, instructor and admin", () => {
    for (const name of ["student", "instructor", "admin"]) expect(isSystemRole(name)).toBe(true);
  });
  it("is false for custom roles, and matches exactly", () => {
    expect(isSystemRole("content-editor")).toBe(false);
    expect(isSystemRole("Admin")).toBe(false);
  });
});
