import { diffSnapshots, type PostSnapshot } from "@/lib/revision-diff";

type RevisionCompareProps = {
  before: { label: string; snapshot: PostSnapshot };
  after: { label: string; snapshot: PostSnapshot };
};

// Shows which fields changed and the body's text with additions and removals marked.
export function RevisionCompare({ before, after }: RevisionCompareProps) {
  const { changes, body } = diffSnapshots(before.snapshot, after.snapshot);

  if (changes.length === 0 && !body) {
    return <p className="text-sm text-slate-500">{before.label} and {after.label} are identical.</p>;
  }

  return (
    <div className="grid gap-4">
      {changes.length > 0 && (
        <table className="w-full text-sm">
          <caption className="sr-only">Changed fields</caption>
          <thead>
            <tr className="text-left text-slate-500">
              <th scope="col" className="py-1 pr-3 font-medium">Field</th>
              <th scope="col" className="py-1 pr-3 font-medium">{before.label}</th>
              <th scope="col" className="py-1 font-medium">{after.label}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.field} className="border-t align-top">
                <th scope="row" className="py-2 pr-3 text-left font-medium">{c.label}</th>
                <td className="py-2 pr-3 break-words text-red-800">{c.before}</td>
                <td className="py-2 break-words text-emerald-800">{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {body && (
        <section aria-labelledby="body-diff">
          <h3 id="body-diff" className="mb-2 text-sm font-semibold">Body text</h3>
          <p className="rounded-lg border bg-white p-3 text-sm leading-relaxed">
            {body.map((segment, i) =>
              segment.type === "same" ? (
                <span key={i}>{segment.text} </span>
              ) : segment.type === "add" ? (
                <ins key={i} className="bg-emerald-100 text-emerald-900 no-underline">
                  <span className="sr-only">Added: </span>{segment.text}{" "}
                </ins>
              ) : (
                <del key={i} className="bg-red-100 text-red-900">
                  <span className="sr-only">Removed: </span>{segment.text}{" "}
                </del>
              ),
            )}
          </p>
        </section>
      )}
    </div>
  );
}
