import { describe, expect, it } from "vitest";
import { panelForRole, panelHome } from "@/lib/panel";

describe("panelForRole", () => {
  it("sends students and users without a role to the student panel", () => {
    expect(panelForRole("student")).toBe("student");
    expect(panelForRole(null)).toBe("student");
  });

  it("sends instructors to the instructor panel", () => {
    expect(panelForRole("instructor")).toBe("instructor");
  });

  it("sends every other role to the admin panel", () => {
    for (const role of ["admin", "moderator", "content-editor", "Student"]) {
      expect(panelForRole(role)).toBe("admin");
    }
  });
});

describe("panelHome", () => {
  it("maps each panel to its home path", () => {
    expect(panelHome("student")).toBe("/dashboard");
    expect(panelHome("instructor")).toBe("/instructor");
    expect(panelHome("admin")).toBe("/admin");
  });
});
