import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  checkCoupon,
  normaliseCouponCode,
  toPence,
  type CouponCheckResult,
  type CouponRules,
  type CouponUsage,
  type PricedLine,
} from "@/lib/commerce";

// Coupons: loading, evaluating against a cart, and taking / giving back a use.
// The rules themselves live in src/lib/commerce.ts (checkCoupon).

type Client = Prisma.TransactionClient | typeof db;

const couponSelect = {
  id: true,
  code: true,
  discountType: true,
  value: true,
  active: true,
  startsAt: true,
  expiresAt: true,
  usageLimit: true,
  perUserLimit: true,
  minSpend: true,
  courses: { select: { courseId: true } },
  categories: { select: { categoryId: true } },
  users: { select: { userId: true } },
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof couponSelect }>;

export type LoadedCoupon = { id: number; rules: CouponRules };

function toLoaded(row: CouponRow): LoadedCoupon {
  return {
    id: row.id,
    rules: {
      code: row.code,
      discountType: row.discountType,
      value: Number(row.value),
      active: row.active,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      usageLimit: row.usageLimit,
      perUserLimit: row.perUserLimit,
      minSpendPence: row.minSpend === null ? null : toPence(Number(row.minSpend)),
      courseIds: row.courses.map((c) => c.courseId),
      categoryIds: row.categories.map((c) => c.categoryId),
      userIds: row.users.map((u) => u.userId),
    },
  };
}

// The coupon for a typed code (any case, spaces trimmed) with its restrictions,
// or null when there is none.
export async function getCouponByCode(code: string, client: Client = db): Promise<LoadedCoupon | null> {
  const normalised = normaliseCouponCode(code);
  if (!normalised) return null;
  const row = await client.coupon.findUnique({ where: { code: normalised }, select: couponSelect });
  return row ? toLoaded(row) : null;
}

// Counted uses: redemptions not released. `byUser` is null-safe for signed-out callers (0).
// `ignoreOwnPending` leaves out the caller's own unpaid orders: checkout
// reuses or replaces those, so they must not count against the same learner
// trying the same code again.
export async function getCouponUsage(
  couponId: number,
  userId: number | null,
  client: Client = db,
  options: { ignoreOwnPending?: boolean } = {},
): Promise<CouponUsage> {
  const notOwnPending: Prisma.CouponRedemptionWhereInput =
    options.ignoreOwnPending && userId !== null ? { NOT: { userId, order: { status: "PENDING" } } } : {};
  const [total, byUser] = await Promise.all([
    client.couponRedemption.count({ where: { couponId, releasedAt: null, ...notOwnPending } }),
    userId === null
      ? 0
      : client.couponRedemption.count({ where: { couponId, userId, releasedAt: null, ...notOwnPending } }),
  ]);
  return { total, byUser };
}

export type EvaluatedCoupon = (CouponCheckResult & { ok: true; couponId: number }) | (CouponCheckResult & { ok: false });

// What a code would do to these cart lines for this learner right now. Read
// only: the use is taken later, by reserveCouponUse, when the order is placed.
export async function evaluateCoupon(
  user: { id: number } | null,
  lines: readonly PricedLine[],
  code: string,
  options: { ignoreOwnPending?: boolean } = {},
): Promise<EvaluatedCoupon> {
  const coupon = await getCouponByCode(code);
  const usage = coupon ? await getCouponUsage(coupon.id, user?.id ?? null, db, options) : { total: 0, byUser: 0 };
  const result = checkCoupon({ rules: coupon?.rules ?? null, lines, usage, userId: user?.id ?? null, now: new Date() });
  return result.ok ? { ...result, couponId: coupon!.id } : result;
}

export type ReserveResult = (CouponCheckResult & { ok: true; redemptionId: number }) | (CouponCheckResult & { ok: false });

// Takes one use of a coupon for an order, inside the caller's transaction.
//
// Concurrency on MySQL/MariaDB (InnoDB): the check and the insert must not
// interleave with another reservation of the same coupon. So the first thing
// done is `SELECT ... FROM coupon WHERE id = ? FOR UPDATE`, an exclusive row
// lock: a second reservation of that coupon waits there until the first
// transaction commits or rolls back, then counts the redemptions with locking
// reads (`LOCK IN SHARE MODE`, which see the latest committed rows whatever
// the transaction snapshot says), re-runs the full checkCoupon, and only then
// inserts. Reservations of different coupons do not block each other.
//
// The order row must already exist in `tx` (the redemption points at it). When
// the result is not ok the caller must throw to roll the whole order back.
// Idempotent per order: an unreleased redemption is returned as is; a released
// one (late payment on an expired order) is taken again after the checks.
export async function reserveCouponUse(
  tx: Prisma.TransactionClient,
  input: { couponId: number; userId: number; orderId: number; lines: readonly PricedLine[]; now?: Date },
): Promise<ReserveResult> {
  const now = input.now ?? new Date();
  await tx.$queryRaw`SELECT id FROM coupon WHERE id = ${input.couponId} FOR UPDATE`;

  const existing = await tx.couponRedemption.findUnique({
    where: { orderId: input.orderId },
    select: { id: true, releasedAt: true },
  });
  const coupon = await tx.coupon.findUnique({ where: { id: input.couponId }, select: couponSelect });

  const [{ n: total }] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM coupon_redemption
    WHERE couponId = ${input.couponId} AND releasedAt IS NULL AND orderId <> ${input.orderId} LOCK IN SHARE MODE`;
  const [{ n: byUser }] = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM coupon_redemption
    WHERE couponId = ${input.couponId} AND userId = ${input.userId} AND releasedAt IS NULL AND orderId <> ${input.orderId} LOCK IN SHARE MODE`;

  const result = checkCoupon({
    rules: coupon ? toLoaded(coupon).rules : null,
    lines: input.lines,
    usage: { total: Number(total), byUser: Number(byUser) },
    userId: input.userId,
    now,
  });
  if (!result.ok) return result;

  if (existing) {
    if (existing.releasedAt) {
      await tx.couponRedemption.update({ where: { id: existing.id }, data: { releasedAt: null } });
    }
    return { ...result, redemptionId: existing.id };
  }
  const row = await tx.couponRedemption.create({
    data: { couponId: input.couponId, userId: input.userId, orderId: input.orderId },
    select: { id: true },
  });
  return { ...result, redemptionId: row.id };
}

// Gives the use back when an order fails, is cancelled or expires. Safe to
// call twice. Returns whether a use was actually released.
export async function releaseCouponUse(orderId: number, client: Client = db): Promise<boolean> {
  const { count } = await client.couponRedemption.updateMany({
    where: { orderId, releasedAt: null },
    data: { releasedAt: new Date() },
  });
  return count > 0;
}


// ---------------------------------------------------------------- offers

export type Offer = {
  id: number;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  minSpend: number | null;
  expiresAt: Date | null;
  // Reserved for this learner (and perhaps a few others) rather than open to all.
  personal: boolean;
  // What it can be spent on; both empty means every course.
  courses: string[];
  categories: string[];
  // Uses this learner has left, or null when there is no limit per learner.
  usesLeft: number | null;
};

// The coupons this learner could use at checkout right now: switched on,
// inside their dates, open to them, and with uses left both overall and for
// them. A coupon limited to courses they already have is left out. Their own
// unpaid orders do not count as uses, the same as at checkout.
export async function listOffersForUser(userId: number, now = new Date()): Promise<Offer[]> {
  const coupons = await db.coupon.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        { OR: [{ users: { none: {} } }, { users: { some: { userId } } }] },
      ],
    },
    orderBy: [{ expiresAt: "asc" }, { id: "desc" }],
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      value: true,
      minSpend: true,
      expiresAt: true,
      usageLimit: true,
      perUserLimit: true,
      courses: { select: { courseId: true, course: { select: { title: true, status: true } } } },
      categories: { select: { category: { select: { name: true } } } },
      _count: { select: { users: true } },
    },
  });
  if (coupons.length === 0) return [];

  const ids = coupons.map((c) => c.id);
  const counted: Prisma.CouponRedemptionWhereInput = { couponId: { in: ids }, releasedAt: null, NOT: { userId, order: { status: "PENDING" } } };
  const [totals, mine, owned] = await Promise.all([
    db.couponRedemption.groupBy({ by: ["couponId"], where: counted, _count: { _all: true } }),
    db.couponRedemption.groupBy({ by: ["couponId"], where: { ...counted, userId }, _count: { _all: true } }),
    db.enrolment.findMany({ where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { courseId: true } }),
  ]);
  const totalBy = new Map(totals.map((t) => [t.couponId, t._count._all]));
  const mineBy = new Map(mine.map((t) => [t.couponId, t._count._all]));
  const ownedCourses = new Set(owned.map((e) => e.courseId));

  return coupons.flatMap((c): Offer[] => {
    const used = mineBy.get(c.id) ?? 0;
    if (c.usageLimit !== null && (totalBy.get(c.id) ?? 0) >= c.usageLimit) return [];
    if (c.perUserLimit !== null && used >= c.perUserLimit) return [];
    // Only for named courses, and none of them is left to buy.
    const buyable = c.courses.filter((x) => x.course.status === "PUBLISHED" && !ownedCourses.has(x.courseId));
    if (c.courses.length > 0 && c.categories.length === 0 && buyable.length === 0) return [];
    return [
      {
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        value: Number(c.value),
        minSpend: c.minSpend === null ? null : Number(c.minSpend),
        expiresAt: c.expiresAt,
        personal: c._count.users > 0,
        courses: buyable.map((x) => x.course.title),
        categories: c.categories.map((x) => x.category.name),
        usesLeft: c.perUserLimit === null ? null : c.perUserLimit - used,
      },
    ];
  });
}
