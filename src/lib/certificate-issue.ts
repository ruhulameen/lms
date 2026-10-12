import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { generateCertificateCode } from "@/lib/course";

// Creating certificate rows. Kept free of request code (no headers, no
// activity log) so the seed can use it too; src/services/certificate.ts wraps
// it for the app and logs.

const MAX_CODE_TRIES = 5;

export type IssueRecord = { id: number; code: string; created: boolean } | null;

// One certificate per enrolment: returns the existing one if there is one.
// Null when the enrolment does not exist. A clash on the random code is
// retried with a new one; a clash on the enrolment means another request just
// issued it, and that one is returned.
export async function issueCertificateRecord(enrolmentId: number): Promise<IssueRecord> {
  const existing = await db.certificate.findUnique({ where: { enrolmentId }, select: { id: true, code: true } });
  if (existing) return { ...existing, created: false };

  const enrolment = await db.enrolment.findUnique({
    where: { id: enrolmentId },
    select: { userId: true, courseId: true, completedAt: true, user: { select: { name: true } }, course: { select: { title: true } } },
  });
  if (!enrolment) return null;

  for (let attempt = 0; attempt < MAX_CODE_TRIES; attempt++) {
    try {
      const created = await db.certificate.create({
        data: {
          enrolmentId,
          userId: enrolment.userId,
          courseId: enrolment.courseId,
          code: generateCertificateCode(),
          issuedAt: enrolment.completedAt ?? new Date(),
          learnerName: enrolment.user.name,
          courseTitle: enrolment.course.title,
        },
        select: { id: true, code: true },
      });
      return { ...created, created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      const raced = await db.certificate.findUnique({ where: { enrolmentId }, select: { id: true, code: true } });
      if (raced) return { ...raced, created: false };
    }
  }
  throw new Error("Could not find a free certificate code.");
}

// Certificates for every COMPLETED enrolment that has none (sample data, or
// enrolments completed before certificates existed). Safe to run again.
export async function backfillCertificateRecords() {
  const missing = await db.enrolment.findMany({
    where: { status: "COMPLETED", certificate: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const created: { id: number; code: string; enrolmentId: number }[] = [];
  for (const { id } of missing) {
    const record = await issueCertificateRecord(id);
    if (record?.created) created.push({ id: record.id, code: record.code, enrolmentId: id });
  }
  return created;
}
