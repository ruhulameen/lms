import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { backfillCertificateRecords, issueCertificateRecord } from "@/lib/certificate-issue";
import { db } from "@/lib/db";
import { logActivity } from "@/services/activity";
import { notify } from "@/services/notification";

// Certificates: issuing (automatic, on course completion), the public lookup
// and the admin list with revoke / restore. Codes: see src/lib/course.ts.

// Idempotent: one certificate per enrolment. Called when a course is completed.
export async function issueCertificate(enrolmentId: number) {
  const record = await issueCertificateRecord(enrolmentId);
  if (record?.created) {
    const row = await db.certificate.findUnique({
      where: { id: record.id },
      select: { userId: true, courseId: true, courseTitle: true },
    });
    await logActivity({
      userId: row?.userId,
      action: "certificate.issue",
      entity: "certificate",
      entityId: record.id,
      details: { course: row?.courseTitle ?? "", code: record.code, enrolmentId },
    });
    await notify(row?.userId, {
      type: "certificate.issued",
      title: `Course completed: ${row?.courseTitle ?? "your course"}`,
      body: "Well done. Your certificate is ready to view and print.",
      link: "/my-certificates",
    });
  }
  return record;
}

export async function backfillCertificates() {
  const created = await backfillCertificateRecords();
  for (const certificate of created) {
    const row = await db.certificate.findUnique({
      where: { id: certificate.id },
      select: { userId: true, courseTitle: true },
    });
    await logActivity({
      userId: row?.userId,
      action: "certificate.issue",
      entity: "certificate",
      entityId: certificate.id,
      details: { course: row?.courseTitle ?? "", code: certificate.code, enrolmentId: certificate.enrolmentId, backfill: true },
    });
  }
  return created;
}

export type PublicCertificate = {
  code: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  revoked: boolean;
};

// For the public verification page. Nothing private (no email, no ids).
export async function getCertificateByCode(code: string): Promise<PublicCertificate | null> {
  const row = await db.certificate.findUnique({
    where: { code },
    select: { code: true, learnerName: true, courseTitle: true, issuedAt: true, revokedAt: true },
  });
  if (!row) return null;
  return { code: row.code, learnerName: row.learnerName, courseTitle: row.courseTitle, issuedAt: row.issuedAt, revoked: row.revokedAt !== null };
}

export const CERTIFICATE_PAGE_SIZE = 15;
export const CERTIFICATE_SORT_KEYS = ["learner", "course", "code", "issued", "status"] as const;
export type CertificateSortKey = (typeof CERTIFICATE_SORT_KEYS)[number];

export type CertificateListFilters = {
  search?: string;
  status?: "VALID" | "REVOKED";
  courseId?: number;
  page?: number;
  sort: CertificateSortKey;
  order: "asc" | "desc";
};

export async function listCertificates(filters: CertificateListFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();
  const where: Prisma.CertificateWhereInput = {
    ...(filters.status === "VALID" ? { revokedAt: null } : filters.status === "REVOKED" ? { revokedAt: { not: null } } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(search
      ? {
          OR: [
            { learnerName: { contains: search } },
            { courseTitle: { contains: search } },
            { code: { contains: search.toUpperCase().replace(/\s+/g, "") } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  };
  const direction = filters.order;
  const orderBy: Prisma.CertificateOrderByWithRelationInput[] = [
    filters.sort === "learner"
      ? { learnerName: direction }
      : filters.sort === "course"
        ? { courseTitle: direction }
        : filters.sort === "code"
          ? { code: direction }
          : filters.sort === "status"
            ? { revokedAt: direction }
            : { issuedAt: direction },
    { id: "desc" },
  ];
  const [rows, total] = await Promise.all([
    db.certificate.findMany({
      where,
      orderBy,
      skip: (page - 1) * CERTIFICATE_PAGE_SIZE,
      take: CERTIFICATE_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        learnerName: true,
        courseTitle: true,
        issuedAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true } },
        course: { select: { id: true } },
        revokedBy: { select: { name: true } },
      },
    }),
    db.certificate.count({ where }),
  ]);
  return { rows, total, page, pageSize: CERTIFICATE_PAGE_SIZE };
}

export type SetRevokedResult = { ok: true; changed: boolean } | { ok: false; error: string };

// Revoke (revoked = true) or restore a certificate. Nothing is deleted: the
// verification page shows a revoked certificate as revoked.
export async function setCertificateRevoked(certificateId: number, revoked: boolean, actorId: number): Promise<SetRevokedResult> {
  const row = await db.certificate.findUnique({
    where: { id: certificateId },
    select: { id: true, code: true, userId: true, courseTitle: true, learnerName: true, revokedAt: true },
  });
  if (!row) return { ok: false, error: "This certificate no longer exists." };
  if ((row.revokedAt !== null) === revoked) return { ok: true, changed: false };

  await db.certificate.update({
    where: { id: certificateId },
    data: revoked ? { revokedAt: new Date(), revokedById: actorId } : { revokedAt: null, revokedById: null },
  });
  await logActivity({
    userId: actorId,
    action: revoked ? "certificate.revoke" : "certificate.restore",
    entity: "certificate",
    entityId: certificateId,
    details: { code: row.code, learner: row.learnerName, course: row.courseTitle },
  });
  return { ok: true, changed: true };
}
