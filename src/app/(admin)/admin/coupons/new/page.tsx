import type { Metadata } from "next";
import { CouponForm } from "@/components/admin/coupon-form";
import { PageHeader } from "@/components/admin/page-header";
import { parseRouteId } from "@/lib/route-id";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { listCourseCategoryOptions } from "@/services/course-admin";
import { getCouponToDuplicate } from "@/services/coupon-admin";
import { listCourseOptions } from "@/services/learners";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "New coupon" };

// `?from=<id>` starts from an existing coupon's rules (Duplicate), with no code.
export default async function NewCouponPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("coupon.manage");
  const query = await searchParams;
  const fromId = parseRouteId(firstParam(query.from) ?? "");
  const [source, courses, categories] = await Promise.all([
    fromId ? getCouponToDuplicate(fromId) : null,
    listCourseOptions(),
    listCourseCategoryOptions(),
  ]);

  return (
    <>
      <PageHeader title="New coupon" description="A discount code for learners to type at checkout." />
      <CouponForm
        mode="create"
        coupon={source ?? undefined}
        copiedFrom={source?.sourceCode}
        courses={courses}
        categories={categories}
      />
    </>
  );
}
