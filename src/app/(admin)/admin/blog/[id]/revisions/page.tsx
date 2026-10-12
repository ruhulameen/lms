import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RevisionCompare } from "@/components/admin/revision-compare";
import { RevisionList } from "@/components/admin/revision-list";
import { PageHeader } from "@/components/admin/page-header";
import { selectClassName } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { parseRouteId } from "@/lib/route-id";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { getPostHeading } from "@/services/post";
import { getCurrentPostSnapshot, getPostRevision, listPostRevisions } from "@/services/revision";
import { requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Revisions" };

const CURRENT = "current";

export default async function PostRevisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission("post.view");
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const post = await getPostHeading(id);
  if (!post) notFound();

  const revisions = await listPostRevisions(id);
  const from = firstParam(query.from);
  const to = firstParam(query.to);

  async function side(value: string | undefined) {
    if (!value) return null;
    if (value === CURRENT) {
      const snapshot = await getCurrentPostSnapshot(id!);
      return snapshot ? { label: "Current version", snapshot } : null;
    }
    const n = parseRouteId(value);
    const revision = n ? await getPostRevision(id!, n) : null;
    return revision ? { label: `Revision ${revision.number}`, snapshot: revision.snapshot } : null;
  }
  const [before, after] = await Promise.all([side(from), side(to)]);
  const comparing = Boolean(from && to);

  const options = [
    { value: CURRENT, label: "Current version" },
    ...revisions.map((r) => ({ value: String(r.number), label: `Revision ${r.number}` })),
  ];

  return (
    <>
      <PageHeader
        title="Revisions"
        description={`${post.title} · /blog/${post.slug}`}
        actions={
          <Button variant="outline" render={<Link href={`/admin/blog/${post.id}`} />}>
            Back to the post
          </Button>
        }
      />

      <div className="grid gap-6">
        <section aria-labelledby="history">
          <h2 id="history" className="mb-2 text-base font-bold text-slate-900">History</h2>
          <RevisionList
            revisions={revisions}
            hrefFor={(n) => `/admin/blog/${post.id}/revisions/${n}`}
            currentNumber={revisions[0]?.number}
          />
        </section>

        {revisions.length > 0 && (
          <section aria-labelledby="compare" className="rounded-xl border bg-white p-4 sm:p-6">
            <h2 id="compare" className="mb-3 text-base font-bold text-slate-900">Compare</h2>
            <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                From
                <select name="from" defaultValue={from ?? String(revisions.at(-1)?.number ?? "")} className={`${selectClassName} min-w-44`}>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                To
                <select name="to" defaultValue={to ?? CURRENT} className={`${selectClassName} min-w-44`}>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <Button type="submit">Compare</Button>
            </form>
            {comparing && before && after ? (
              <RevisionCompare before={before} after={after} />
            ) : comparing ? (
              <p role="alert" className="text-sm text-destructive">One of those versions does not exist.</p>
            ) : (
              <p className="text-sm text-slate-500">Choose two versions to see what changed between them.</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
