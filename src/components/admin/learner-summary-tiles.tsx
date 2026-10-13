import { money } from "@/lib/order-display";

type Tile = { label: string; value: string };

// The headline figures at the top of a learner page. Money tiles are passed in
// only when the viewer has order.view.
export function LearnerSummaryTiles({
  learning,
  money: figures,
}: {
  learning: { courses: number; completed: number; averageProgress: number; certificates: number };
  money?: { orders: number; lifetimeValue: number; refunded: number };
}) {
  const tiles: Tile[] = [
    { label: "Courses", value: String(learning.courses) },
    { label: "Completed", value: String(learning.completed) },
    { label: "Average progress", value: `${learning.averageProgress}%` },
    { label: "Certificates", value: String(learning.certificates) },
    ...(figures
      ? [
          { label: "Orders", value: String(figures.orders) },
          { label: "Lifetime value", value: money(figures.lifetimeValue) },
          { label: "Refunded", value: money(figures.refunded) },
        ]
      : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border bg-white px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">{tile.label}</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
