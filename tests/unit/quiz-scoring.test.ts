import { describe, expect, it } from "vitest";
import {
  QUIZ_GRACE_SECONDS,
  attemptTime,
  attemptsLeft,
  canStartAttempt,
  isPassing,
  scoreAttempt,
  scoreQuestion,
  type ScorableQuestion,
} from "@/lib/quiz";

const opt = (id: string, correct = false) => ({ id, text: id, correct });
const single: ScorableQuestion = { id: 1, points: 2, options: [opt("a", true), opt("b"), opt("c")] };
const multiple: ScorableQuestion = { id: 2, points: 3, options: [opt("a", true), opt("b", true), opt("c")] };
const trueFalse: ScorableQuestion = { id: 3, points: 1, options: [opt("true", true), opt("false")] };

describe("scoreQuestion", () => {
  it("scores a single choice and a true/false question", () => {
    expect(scoreQuestion(single, ["a"])).toMatchObject({ correct: true, earned: 2 });
    expect(scoreQuestion(single, ["b"])).toMatchObject({ correct: false, earned: 0 });
    expect(scoreQuestion(trueFalse, ["true"])).toMatchObject({ correct: true, earned: 1 });
  });
  it("is all or nothing for multiple choice", () => {
    expect(scoreQuestion(multiple, ["b", "a"]).earned).toBe(3);
    expect(scoreQuestion(multiple, ["a"]).earned).toBe(0);
    expect(scoreQuestion(multiple, ["a", "b", "c"]).earned).toBe(0);
  });
  it("ignores unknown ids and treats no answer as wrong", () => {
    expect(scoreQuestion(single, ["a", "zzz"])).toMatchObject({ correct: true, selected: ["a"] });
    expect(scoreQuestion(single, ["zzz"]).correct).toBe(false);
    expect(scoreQuestion(single, undefined).earned).toBe(0);
  });
});

describe("scoreAttempt", () => {
  it("adds up points and compares with the passing score", () => {
    const result = scoreAttempt([single, multiple, trueFalse], { "1": ["a"], "2": ["a"], "3": ["true"] }, 50);
    expect(result).toMatchObject({ score: 3, maxScore: 6, percent: 50, passed: true });
    expect(scoreAttempt([single], {}, 50)).toMatchObject({ score: 0, passed: false });
  });
});

describe("isPassing", () => {
  it("passes at exactly the passing percent, not just below it", () => {
    expect(isPassing(7, 10, 70)).toBe(true);
    expect(isPassing(69, 100, 70)).toBe(false);
  });
  it("never passes a quiz worth nothing", () => {
    expect(isPassing(0, 0, 0)).toBe(false);
  });
});

describe("attempt limits", () => {
  it("counts attempts left and blocks a new one at the limit", () => {
    expect(attemptsLeft(3, 1)).toBe(2);
    expect(attemptsLeft(3, 5)).toBe(0);
    expect(attemptsLeft(null, 9)).toBeNull();
    expect(canStartAttempt(3, 2)).toBe(true);
    expect(canStartAttempt(3, 3)).toBe(false);
    expect(canStartAttempt(null, 99)).toBe(true);
  });
});

describe("attemptTime", () => {
  const started = new Date("2026-01-01T10:00:00Z");
  const at = (secondsAfter: number) => new Date(started.getTime() + secondsAfter * 1000);
  it("is open within the limit, in grace just after it, then expired", () => {
    expect(attemptTime(started, 10, at(600))).toBe("open");
    expect(attemptTime(started, 10, at(600 + QUIZ_GRACE_SECONDS))).toBe("grace");
    expect(attemptTime(started, 10, at(600 + QUIZ_GRACE_SECONDS + 1))).toBe("expired");
  });
  it("is always open without a time limit", () => {
    expect(attemptTime(started, null, at(99999))).toBe("open");
  });
});
