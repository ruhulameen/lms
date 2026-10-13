import Link from "next/link";
import { Star } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/activity-details";
import type { LearnerCertificate, LearnerReviewRow } from "@/services/learner-insight";
import type { QuizResultRow } from "@/services/learners";

const Heading = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-base font-bold text-slate-900">
    {children}
  </h2>
);

export function LearnerQuizSection({ quizzes }: { quizzes: QuizResultRow[] }) {
  return (
    <section aria-labelledby="quizzes" className="scroll-mt-4">
      <div className="mb-3">
        <Heading id="quizzes">Quiz results</Heading>
      </div>
      {quizzes.length === 0 ? (
        <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">No quiz attempts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <ul className="divide-y">
            {quizzes.map((quiz) => (
              <li key={quiz.lessonId} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
                <span className="min-w-0 flex-1 basis-full sm:basis-0">
                  <span className="block font-medium">{quiz.lessonTitle}</span>
                  <span className="block text-xs text-slate-500">{quiz.courseTitle}</span>
                </span>
                <span>
                  {quiz.attempts} {quiz.attempts === 1 ? "attempt" : "attempts"}
                </span>
                <span>Best {quiz.bestPercent ?? 0}%</span>
                {quiz.lastAttemptAt && <span className="text-slate-500">Last {formatDate(quiz.lastAttemptAt)}</span>}
                <StatusBadge label={quiz.passed ? "Passed" : "Not passed"} tone={quiz.passed ? "success" : "warning"} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function LearnerCertificatesSection({ certificates }: { certificates: LearnerCertificate[] }) {
  return (
    <section aria-labelledby="certificates" className="scroll-mt-4 rounded-xl border bg-white">
      <div className="p-4 sm:px-6">
        <Heading id="certificates">Certificates</Heading>
      </div>
      {certificates.length === 0 ? (
        <EmptyState title="No certificates" description="Certificates appear here once a course is completed." />
      ) : (
        <ul className="divide-y border-t">
          {certificates.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
              <span className="min-w-0 flex-1 basis-full sm:basis-0">
                <span className="block font-medium">{c.courseTitle}</span>
                <Link href={`/certificates/${c.code}`} className="font-mono text-xs text-blue-700 hover:underline">
                  {c.code}
                </Link>
              </span>
              <span className="text-xs text-slate-500">Issued {formatDate(c.issuedAt)}</span>
              <StatusBadge label={c.revoked ? "Revoked" : "Valid"} tone={c.revoked ? "danger" : "success"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const reviewTones = { APPROVED: "success", PENDING: "warning", REJECTED: "danger" } as const;
const reviewLabels = { APPROVED: "Approved", PENDING: "Pending", REJECTED: "Rejected" } as const;

export function LearnerReviewsSection({ reviews }: { reviews: LearnerReviewRow[] }) {
  return (
    <section aria-labelledby="reviews" className="scroll-mt-4 rounded-xl border bg-white">
      <div className="p-4 sm:px-6">
        <Heading id="reviews">Reviews written</Heading>
      </div>
      {reviews.length === 0 ? (
        <EmptyState title="No reviews" description="This learner has not reviewed a course." />
      ) : (
        <ul className="divide-y border-t">
          {reviews.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
              <span className="min-w-0 flex-1 basis-full sm:basis-0">
                <span className="block font-medium">{r.courseTitle}</span>
                {r.excerpt && <span className="block truncate text-slate-600">{r.excerpt}</span>}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {r.rating}/5
              </span>
              <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
              <StatusBadge label={reviewLabels[r.status]} tone={reviewTones[r.status]} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
