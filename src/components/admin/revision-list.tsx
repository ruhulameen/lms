import Link from "next/link";
import { formatDate } from "@/lib/activity-details";

export type RevisionListItem = {
  number: number;
  note: string | null;
  createdAt: Date;
  createdBy: { name: string } | null;
};

type RevisionListProps = {
  revisions: RevisionListItem[];
  // Where each revision's own screen lives; omit for a plain list.
  hrefFor?: (number: number) => string;
  // Highlighted as the version currently live/saved.
  currentNumber?: number;
};

export function RevisionList({ revisions, hrefFor, currentNumber }: RevisionListProps) {
  if (revisions.length === 0) return <p className="text-sm text-slate-500">No revisions yet.</p>;
  return (
    <ol className="divide-y rounded-xl border bg-white" aria-label="Revisions">
      {revisions.map((r) => (
        <li key={r.number} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm">
          {hrefFor ? (
            <Link href={hrefFor(r.number)} className="font-medium text-blue-700 hover:underline">
              Revision {r.number}
            </Link>
          ) : (
            <span className="font-medium">Revision {r.number}</span>
          )}
          {r.number === currentNumber && <span className="text-xs font-semibold text-emerald-700">Latest</span>}
          <span className="text-slate-500">
            {formatDate(r.createdAt)} by {r.createdBy?.name ?? "unknown"}
          </span>
          {r.note && <span className="basis-full text-slate-600">{r.note}</span>}
        </li>
      ))}
    </ol>
  );
}
