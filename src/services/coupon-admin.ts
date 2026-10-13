import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { isPaidStatus } from "@/lib/commerce";
import { couponState, type CouponFields, type CouponState } from "@/lib/coupon-form";
import { db } from "@/lib/db";
import { logActivity } from "@/services/activity";
import { notify } from "@/services/notification";

// Coupons from the admin's side: the list, one coupon with its restrictions and
// uses, and create / update / switch / delete. Call after the permission
// checks (coupon.view for reading, coupon.manage for changes). The rules that
// apply a coupon to a cart are in src/lib/commerce.ts and src/services/coupon.ts.

export const COUPON_PAGE_SIZE = 15;
export const COUPON_SORT_KEYS = ["code", "discount", "uses", "expires", "created"] as const;
export type CouponSortKey = (typeof COUPON_SORT_KEYS)[number];

export type CouponRow = {
  id: number;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  active: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  minSpend: number | null;
  courseCount: number;
  categoryCount: number;
  // Learners a personal coupon is reserved for; 0 means anyone.
  userCount: number;
  // Counted uses (not released) and every redemption ever (a coupon with any cannot be deleted).
  uses: number;
  redemptions: number;
  state: CouponState;
  createdAt: Date;
};

async function loadRows(now: Date): Promise<CouponRow[]> {
  const [coupons, used, all] = await Promise.all([
    db.coupon.findMany({
      select: {
        id: true,
        code: true,
        description: true,
        discountType: true,
        value: true,
        active: true,
        startsAt: true,
        expiresAt: true,
        usageLimit: true,
        perUserLimit: true,
        minSpend: true,
        createdAt: true,
        _count: { select: { courses: true, categories: true, users: true } },
      },
    }),
    db.couponRedemption.groupBy({ by: ["couponId"], where: { releasedAt: null }, _count: { _all: true } }),
    db.couponRedemption.groupBy({ by: ["couponId"], _count: { _all: true } }),
  ]);
  const usedBy = new Map(used.map((u) => [u.couponId, u._count._all]));
  const allBy = new Map(all.map((u) => [u.couponId, u._count._all]));
  return coupons.map((c) => {
    const uses = usedBy.get(c.id) ?? 0;
    return {
      id: c.id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      value: Number(c.value),
      active: c.active,
      startsAt: c.startsAt,
      expiresAt: c.expiresAt,
      usageLimit: c.usageLimit,
      perUserLimit: c.perUserLimit,
      minSpend: c.minSpend === null ? null : Number(c.minSpend),
      courseCount: c._count.courses,
      categoryCount: c._count.categories,
      userCount: c._count.users,
      uses,
      redemptions: allBy.get(c.id) ?? 0,
      state: couponState({ active: c.active, startsAt: c.startsAt, expiresAt: c.expiresAt, usageLimit: c.usageLimit }, uses, now),
      createdAt: c.createdAt,
    };
  });
}

export type CouponListFilters = {
  search?: string;
  state?: CouponState;
  page?: number;
  pageSize?: number;
  sort: CouponSortKey;
  order: "asc" | "desc";
};

// There are only ever a handful of coupons, and the state depends on the
// clock and the redemption count, so filtering, sorting and paging happen here
// rather than in SQL.
export async function listCoupons(filters: CouponListFilters, now = new Date()) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = filters.pageSize ?? COUPON_PAGE_SIZE;
  const search = filters.search?.trim().toLowerCase();

  let rows = await loadRows(now);
  if (filters.state) rows = rows.filter((r) => r.state === filters.state);
  if (search) rows = rows.filter((r) => r.code.toLowerCase().includes(search) || (r.description ?? "").toLowerCase().includes(search));

  const dir = filters.order === "asc" ? 1 : -1;
  const far = Number.MAX_SAFE_INTEGER;
  const key = (r: CouponRow): number | string => {
    switch (filters.sort) {
      case "code":
        return r.code;
      case "discount":
        // Percentages and pounds are not comparable; group by type, then value.
        return (r.discountType === "PERCENTAGE" ? 0 : 1e6) + r.value;
      case "uses":
        return r.uses;
      case "expires":
        return r.expiresAt?.getTime() ?? far;
      default:
        return r.createdAt.getTime();
    }
  };
  rows.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const cmp = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
    return cmp * dir || b.id - a.id;
  });

  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

export async function getCouponForEdit(id: number) {
  const coupon = await db.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      description: true,
      internalNote: true,
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
    },
  });
  if (!coupon) return null;
  const [uses, redemptions] = await Promise.all([
    db.couponRedemption.count({ where: { couponId: id, releasedAt: null } }),
    db.couponRedemption.count({ where: { couponId: id } }),
  ]);
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    internalNote: coupon.internalNote,
    discountType: coupon.discountType,
    value: Number(coupon.value),
    active: coupon.active,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    expiresAt: coupon.expiresAt?.toISOString() ?? null,
    usageLimit: coupon.usageLimit,
    perUserLimit: coupon.perUserLimit,
    minSpend: coupon.minSpend === null ? null : Number(coupon.minSpend),
    courseIds: coupon.courses.map((c) => c.courseId),
    categoryIds: coupon.categories.map((c) => c.categoryId),
    userIds: coupon.users.map((u) => u.userId),
    uses,
    redemptions,
    state: couponState(
      { active: coupon.active, startsAt: coupon.startsAt, expiresAt: coupon.expiresAt, usageLimit: coupon.usageLimit },
      uses,
      new Date(),
    ),
  };
}

export type CouponForEdit = NonNullable<Awaited<ReturnType<typeof getCouponForEdit>>>;

// Every use of a coupon, newest first, with what it added up to.
export async function listCouponRedemptions(couponId: number) {
  const rows = await db.couponRedemption.findMany({
    where: { couponId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      releasedAt: true,
      user: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true, discountTotal: true } },
    },
  });
  const mapped = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    releasedAt: r.releasedAt,
    user: r.user,
    order: { id: r.order.id, orderNumber: r.order.orderNumber, status: r.order.status, discount: Number(r.order.discountTotal) },
  }));
  const counted = mapped.filter((r) => !r.releasedAt);
  return {
    rows: mapped,
    uses: counted.length,
    // Discount on orders that were actually paid (pending ones may still fall through).
    discountGiven: counted.filter((r) => isPaidStatus(r.order.status)).reduce((sum, r) => sum + r.order.discount, 0),
  };
}

// ---------------------------------------------------------------- changes

type Failure = { ok: false; error: string; fieldErrors?: Record<string, string[]> };
type Restrictions = { courseIds: number[]; categoryIds: number[]; userIds: number[] };

const CODE_TAKEN = "Another coupon already uses this code.";
const NOT_FOUND = "This coupon no longer exists.";

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Tells learners a coupon has been reserved for them.
async function notifyPersonalCoupon(userIds: number[], fields: CouponFields) {
  const amount = fields.discountType === "PERCENTAGE" ? `${fields.value}%` : `£${fields.value.toFixed(2)}`;
  for (const userId of userIds) {
    await notify(userId, {
      type: "coupon.personal",
      title: `A coupon just for you: ${amount} off`,
      body: `Use code ${fields.code} at checkout.`,
      link: "/my-offers",
    });
  }
}

// Keeps only the courses, categories and learners that still exist.
async function existingRestrictions(input: Restrictions): Promise<Restrictions> {
  const [courses, categories, users] = await Promise.all([
    input.courseIds.length ? db.course.findMany({ where: { id: { in: input.courseIds } }, select: { id: true } }) : [],
    input.categoryIds.length ? db.courseCategory.findMany({ where: { id: { in: input.categoryIds } }, select: { id: true } }) : [],
    input.userIds.length ? db.user.findMany({ where: { id: { in: input.userIds } }, select: { id: true } }) : [],
  ]);
  return { courseIds: courses.map((c) => c.id), categoryIds: categories.map((c) => c.id), userIds: users.map((u) => u.id) };
}

const columns = (fields: CouponFields) => ({
  code: fields.code,
  description: fields.description,
  internalNote: fields.internalNote,
  discountType: fields.discountType,
  value: fields.value,
  active: fields.active,
  startsAt: fields.startsAt,
  expiresAt: fields.expiresAt,
  usageLimit: fields.usageLimit,
  perUserLimit: fields.perUserLimit,
  minSpend: fields.minSpend,
});

export async function createCoupon(actor: { id: number }, fields: CouponFields, restrictions: Restrictions): Promise<{ ok: true; id: number } | Failure> {
  if (await db.coupon.findUnique({ where: { code: fields.code }, select: { id: true } })) {
    return { ok: false, error: CODE_TAKEN, fieldErrors: { code: [CODE_TAKEN] } };
  }
  const { courseIds, categoryIds, userIds } = await existingRestrictions(restrictions);
  try {
    const coupon = await db.coupon.create({
      data: {
        ...columns(fields),
        createdById: actor.id,
        courses: { create: courseIds.map((courseId) => ({ courseId })) },
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        users: { create: userIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    await logActivity({
      userId: actor.id,
      action: "coupon.create",
      entity: "coupon",
      entityId: coupon.id,
      details: { code: fields.code, discountType: fields.discountType, value: fields.value },
    });
    if (fields.active) await notifyPersonalCoupon(userIds, fields);
    return { ok: true, id: coupon.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: CODE_TAKEN, fieldErrors: { code: [CODE_TAKEN] } };
    throw error;
  }
}

export async function updateCoupon(actor: { id: number }, id: number, fields: CouponFields, restrictions: Restrictions): Promise<{ ok: true; code: string } | Failure> {
  const before = await db.coupon.findUnique({ where: { id }, select: { id: true, code: true, value: true, discountType: true } });
  if (!before) return { ok: false, error: NOT_FOUND };
  if (await db.coupon.findFirst({ where: { code: fields.code, id: { not: id } }, select: { id: true } })) {
    return { ok: false, error: CODE_TAKEN, fieldErrors: { code: [CODE_TAKEN] } };
  }
  const { courseIds, categoryIds, userIds } = await existingRestrictions(restrictions);
  // Learners added by this save are told; those who already had it are not told again.
  const had = new Set((await db.couponUser.findMany({ where: { couponId: id }, select: { userId: true } })).map((u) => u.userId));
  try {
    await db.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id }, data: columns(fields) });
      await tx.couponCourse.deleteMany({ where: { couponId: id } });
      await tx.couponCategory.deleteMany({ where: { couponId: id } });
      await tx.couponUser.deleteMany({ where: { couponId: id } });
      if (courseIds.length) await tx.couponCourse.createMany({ data: courseIds.map((courseId) => ({ couponId: id, courseId })) });
      if (categoryIds.length) await tx.couponCategory.createMany({ data: categoryIds.map((categoryId) => ({ couponId: id, categoryId })) });
      if (userIds.length) await tx.couponUser.createMany({ data: userIds.map((userId) => ({ couponId: id, userId })) });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: CODE_TAKEN, fieldErrors: { code: [CODE_TAKEN] } };
    throw error;
  }
  await logActivity({
    userId: actor.id,
    action: "coupon.update",
    entity: "coupon",
    entityId: id,
    details: {
      code: fields.code,
      ...(before.code !== fields.code ? { previousCode: before.code } : {}),
      ...(before.discountType !== fields.discountType || Number(before.value) !== fields.value
        ? { previousDiscount: `${before.discountType} ${Number(before.value)}` }
        : {}),
    },
  });
  if (fields.active) await notifyPersonalCoupon(userIds.filter((userId) => !had.has(userId)), fields);
  return { ok: true, code: fields.code };
}

export async function setCouponActive(actor: { id: number }, id: number, active: boolean): Promise<{ ok: true; code: string } | Failure> {
  const coupon = await db.coupon.findUnique({ where: { id }, select: { id: true, code: true } });
  if (!coupon) return { ok: false, error: NOT_FOUND };
  await db.coupon.update({ where: { id }, data: { active } });
  await logActivity({ userId: actor.id, action: active ? "coupon.activate" : "coupon.deactivate", entity: "coupon", entityId: id, details: { code: coupon.code } });
  return { ok: true, code: coupon.code };
}

// A coupon that has been redeemed (even if the use was given back) stays: the
// database restricts it, and its orders keep pointing at it. Switch it off instead.
export async function deleteCoupon(actor: { id: number }, id: number): Promise<{ ok: true; code: string } | Failure> {
  const coupon = await db.coupon.findUnique({ where: { id }, select: { id: true, code: true, _count: { select: { redemptions: true } } } });
  if (!coupon) return { ok: false, error: NOT_FOUND };
  if (coupon._count.redemptions > 0) {
    return { ok: false, error: `${coupon.code} has been used, so it cannot be deleted. Switch it off instead.` };
  }
  try {
    await db.coupon.delete({ where: { id } });
  } catch (error) {
    // A redemption slipped in between the check and the delete.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2014")) {
      return { ok: false, error: `${coupon.code} has been used, so it cannot be deleted. Switch it off instead.` };
    }
    throw error;
  }
  await logActivity({ userId: actor.id, action: "coupon.delete", entity: "coupon", entityId: id, details: { code: coupon.code } });
  return { ok: true, code: coupon.code };
}

// Starting values for "Duplicate": the restrictions and rules of an existing
// coupon, without its code or uses.
export async function getCouponToDuplicate(id: number) {
  const coupon = await getCouponForEdit(id);
  if (!coupon) return null;
  return { ...coupon, id: undefined as number | undefined, sourceCode: coupon.code, code: "", uses: 0, redemptions: 0 };
}

// Learners to choose from when making a coupon personal.
export async function listCouponLearnerOptions() {
  return db.user.findMany({
    where: { role: { name: "student" } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, email: true },
  });
}
