import { describe, expect, it } from "vitest";
import { progressPercent } from "@/lib/course";
import { completionMode, enrolmentOutcome, videoWatchedEnough } from "@/lib/learning";

describe("progressPercent", () => {
  it.each([
    [0, 0, 0],
    [0, 4, 0],
    [1, 3, 33],
    [2, 3, 67],
    [4, 4, 100],
    [5, 4, 100],
  ])("%i of %i lessons is %i%%", (done, total, expected) => {
    expect(progressPercent(done, total)).toBe(expected);
  });
});

describe("enrolmentOutcome", () => {
  it("completes an active enrolment when every lesson is done", () => {
    expect(enrolmentOutcome(3, 3, "ACTIVE")).toEqual({ percent: 100, status: "COMPLETED", justCompleted: true });
  });
  it("stays active while lessons remain", () => {
    expect(enrolmentOutcome(2, 3, "ACTIVE")).toMatchObject({ percent: 67, status: "ACTIVE", justCompleted: false });
  });
  it("never completes a course with no lessons", () => {
    expect(enrolmentOutcome(0, 0, "ACTIVE")).toMatchObject({ percent: 0, status: "ACTIVE", justCompleted: false });
  });
  it("keeps a completed enrolment completed when a lesson is added later", () => {
    expect(enrolmentOutcome(3, 4, "COMPLETED")).toMatchObject({ percent: 75, status: "COMPLETED", justCompleted: false });
  });
});

describe("completionMode", () => {
  it.each([
    ["VIDEO", true, "watch"],
    ["VIDEO", false, "manual"],
    ["TEXT", false, "manual"],
    ["DOCUMENT", true, "manual"],
    ["QUIZ", false, "quiz"],
  ] as const)("%s (file: %s) is %s", (type, hasFile, mode) => {
    expect(completionMode(type, hasFile)).toBe(mode);
  });
});

describe("videoWatchedEnough", () => {
  it("counts a video as watched from 90% of its length", () => {
    expect(videoWatchedEnough(89, 100)).toBe(false);
    expect(videoWatchedEnough(90, 100)).toBe(true);
  });
  it("is false without a usable duration or position", () => {
    expect(videoWatchedEnough(50, null)).toBe(false);
    expect(videoWatchedEnough(50, 0)).toBe(false);
    expect(videoWatchedEnough(Number.NaN, 100)).toBe(false);
  });
});
