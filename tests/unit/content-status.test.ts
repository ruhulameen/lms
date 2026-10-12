import { describe, expect, it } from "vitest";
import { allowedTransitions, isPublic, parseSchedule, toDatetimeLocalValue } from "@/lib/content-status";

const now = new Date("2026-10-12T12:00:00Z");

describe("isPublic", () => {
  it("is true for published", () => expect(isPublic("PUBLISHED", null, now)).toBe(true));
  it("is true for scheduled once its time has passed", () => {
    expect(isPublic("SCHEDULED", new Date("2026-10-12T11:59:00Z"), now)).toBe(true);
    expect(isPublic("SCHEDULED", new Date("2026-10-12T12:01:00Z"), now)).toBe(false);
    expect(isPublic("SCHEDULED", null, now)).toBe(false);
  });
  it("is false for the other statuses", () => {
    for (const s of ["DRAFT", "PENDING_REVIEW", "ARCHIVED"] as const) expect(isPublic(s, null, now)).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("lets publishers choose any status", () => {
    expect(allowedTransitions("DRAFT", { canEdit: true, canPublish: true })).toHaveLength(5);
  });
  it("limits editors to draft and review", () => {
    expect(allowedTransitions("DRAFT", { canEdit: true, canPublish: false })).toEqual(["DRAFT", "PENDING_REVIEW"]);
    expect(allowedTransitions(null, { canEdit: true, canPublish: false })).toEqual(["DRAFT", "PENDING_REVIEW"]);
  });
  it("gives editors nothing for live content", () => {
    expect(allowedTransitions("PUBLISHED", { canEdit: true, canPublish: false })).toEqual([]);
  });
  it("gives viewers nothing", () => {
    expect(allowedTransitions("DRAFT", { canEdit: false, canPublish: false })).toEqual([]);
  });
});

describe("parseSchedule", () => {
  it("converts local time to UTC using the browser offset", () => {
    // UTC+1 reports -60.
    expect(parseSchedule("2026-10-12T14:30", -60)?.toISOString()).toBe("2026-10-12T13:30:00.000Z");
    // UTC-5 reports 300.
    expect(parseSchedule("2026-10-12T14:30", 300)?.toISOString()).toBe("2026-10-12T19:30:00.000Z");
  });
  it("rejects bad input", () => {
    expect(parseSchedule("2026-02-31T10:00", 0)).toBeNull();
    expect(parseSchedule("tomorrow", 0)).toBeNull();
  });
  it("round-trips with toDatetimeLocalValue", () => {
    const d = parseSchedule("2026-10-12T14:30", -60)!;
    expect(toDatetimeLocalValue(d, -60)).toBe("2026-10-12T14:30");
  });
});
