import { z } from "zod";
import type { StatusTone } from "@/components/admin/status-badge";
import { COUPON_CODE_PATTERN, couponDiscountTypes, ORDER_NUMBER_ALPHABET } from "@/lib/commerce";
import { parseSchedule } from "@/lib/content-status";

// Field rules of the coupon form and how a coupon's state is worked out, shared
// by the actions and the screens. Pure, so client components may import it.

export const COUPON_DESCRIPTION_MAX = 191;
export const COUPON_NOTE_MAX = 2000;
export const COUPON_MAX_AMOUNT = 99999.99;
export const COUPON_MAX_COUNT = 1_000_000;

export const couponTypeLabels = { PERCENTAGE: "Percentage off", FIXED: "Fixed amount off" } as const;

// A random code of letters and numbers that cannot be misread (no 0/O, 1/I/L).
export function generateCouponCode(length = 8, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const limit = 256 - (256 % ORDER_NUMBER_ALPHABET.length);
  let code = "";
  while (code.length < length) {
    for (const byte of random(length * 2)) {
      if (byte < limit && code.length < length) code += ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length];
    }
  }
  return code;
}

const flag = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((v) => v || null);

// A whole number typed by a person, "" = none.
const optionalCount = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx): number | null => {
      if (!v) return null;
      if (!/^\d{1,7}$/.test(v) || Number(v) < 1 || Number(v) > COUPON_MAX_COUNT) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number from 1 to ${COUPON_MAX_COUNT.toLocaleString("en-GB")}, or empty for no limit.` });
        return z.NEVER;
      }
      return Number(v);
    });

const amount = /^\d{1,5}(\.\d{1,2})?$/;

export const couponFieldsSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .superRefine((value, ctx) => {
        if (!COUPON_CODE_PATTERN.test(value)) {
          ctx.addIssue({ code: "custom", message: "Use 2 to 32 letters, numbers, hyphens or underscores, starting with a letter or number." });
        }
      }),
    description: optionalText(COUPON_DESCRIPTION_MAX),
    internalNote: optionalText(COUPON_NOTE_MAX),
    discountType: z.enum(couponDiscountTypes, { error: "Choose how the coupon takes money off." }),
    value: z.string().trim(),
    active: flag,
    startsAtLocal: z.string().trim().optional(),
    expiresAtLocal: z.string().trim().optional(),
    timezoneOffset: z.coerce.number().optional(),
    usageLimit: optionalCount("The usage limit"),
    perUserLimit: optionalCount("The limit per learner"),
    minSpend: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx): number | null => {
        if (!v) return null;
        if (!amount.test(v) || Number(v) <= 0 || Number(v) > COUPON_MAX_AMOUNT) {
          ctx.addIssue({ code: "custom", message: "Enter the minimum spend as an amount like 20 or 19.99, or leave it empty." });
          return z.NEVER;
        }
        return Number(v);
      }),
  })
  .transform((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    let value = 0;
    if (!amount.test(v.value)) {
      issue("value", v.discountType === "PERCENTAGE" ? "Enter a percentage from 1 to 100." : "Enter an amount in pounds like 5 or 4.50.");
    } else {
      value = Number(v.value);
      if (v.discountType === "PERCENTAGE" && (value < 1 || value > 100)) issue("value", "A percentage must be from 1 to 100.");
      if (v.discountType === "FIXED" && (value <= 0 || value > COUPON_MAX_AMOUNT)) issue("value", `An amount must be above £0 and at most £${COUPON_MAX_AMOUNT}.`);
    }

    const offset = v.timezoneOffset ?? 0;
    const parseDate = (path: string, raw: string | undefined) => {
      if (!raw) return null;
      const date = parseSchedule(raw, offset);
      if (!date) issue(path, "Choose a valid date and time.");
      return date;
    };
    const startsAt = parseDate("startsAtLocal", v.startsAtLocal);
    const expiresAt = parseDate("expiresAtLocal", v.expiresAtLocal);
    if (startsAt && expiresAt && expiresAt.getTime() <= startsAt.getTime()) {
      issue("expiresAtLocal", "The use-before date must be after the start date.");
    }
    if (v.usageLimit !== null && v.perUserLimit !== null && v.perUserLimit > v.usageLimit) {
      issue("perUserLimit", "The limit per learner cannot be higher than the total usage limit.");
    }

    return {
      code: v.code,
      description: v.description,
      internalNote: v.internalNote,
      discountType: v.discountType,
      value,
      active: v.active,
      startsAt,
      expiresAt,
      usageLimit: v.usageLimit,
      perUserLimit: v.perUserLimit,
      minSpend: v.minSpend,
    };
  });

export type CouponFields = z.output<typeof couponFieldsSchema>;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const couponStates = ["active", "inactive", "scheduled", "expired", "used_up"] as const;
export type CouponState = (typeof couponStates)[number];

export const couponStateMeta: Record<CouponState, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Switched off", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "danger" },
  used_up: { label: "Used up", tone: "warning" },
};

// What a coupon is right now. A switched-off coupon is "inactive" whatever its
// dates say; then the dates; then the total usage limit (released uses do not count).
export function couponState(
  coupon: { active: boolean; startsAt: Date | null; expiresAt: Date | null; usageLimit: number | null },
  uses: number,
  now: Date,
): CouponState {
  if (!coupon.active) return "inactive";
  if (coupon.expiresAt && now > coupon.expiresAt) return "expired";
  if (coupon.startsAt && now < coupon.startsAt) return "scheduled";
  if (coupon.usageLimit !== null && uses >= coupon.usageLimit) return "used_up";
  return "active";
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "All courses", "3 courses, 1 category", "2 categories".
export function restrictionSummary(courses: number, categories: number) {
  if (courses === 0 && categories === 0) return "All courses";
  return [courses ? plural(courses, "course") : null, categories ? plural(categories, "category", "categories") : null].filter(Boolean).join(", ");
}

// "10% off", "£5.00 off".
export function discountLabel(type: "PERCENTAGE" | "FIXED", value: number) {
  return type === "PERCENTAGE" ? `${Number.isInteger(value) ? value : value.toFixed(2)}% off` : `£${value.toFixed(2)} off`;
}
