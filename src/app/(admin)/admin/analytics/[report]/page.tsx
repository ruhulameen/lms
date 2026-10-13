import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  BadgePercent,
  BookOpenCheck,
  CircleCheck,
  Coins,
  Download,
  Megaphone,
  Percent,
  Radar,
  ReceiptText,
  Repeat,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Star,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { TimeChart } from "@/components/admin/charts";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateInput, formatRangeDates, parseDateRange } from "@/lib/date-range";
import { currencySymbol } from "@/lib/format";
import { formatCell, reportKeys, reportLabels } from "@/lib/report";
import { cn } from "@/lib/utils";
import { getEarliestRecordDate } from "@/services/dashboard";
import { getReport, isReportKey } from "@/services/reports";
import { requirePermission } from "@/services/user";

type Params = { report: string };
type SearchParams = { range?: string; from?: string; to?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { report } = await params;
  return { title: isReportKey(report) ? `${reportLabels[report].title} report` : "Reports" };
}

const icons: Record<string, LucideIcon> = {
  revenue: Coins,
  orders: ShoppingCart,
  average: ReceiptText,
  refunds: RotateCcw,
  discount: BadgePercent,
  enrolments: BookOpenCheck,
  completed: CircleCheck,
  rate: Percent,
  rating: Star,
  signups: UserPlus,
  active: Activity,
  buyers: ShoppingBag,
  repeat: Repeat,
  sources: Radar,
  best: Trophy,
  campaign: Megaphone,
};

export default async function ReportPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  await requirePermission("analytics.view");
  const [{ report: key }, query] = await Promise.all([params, searchParams]);
  if (!isReportKey(key)) notFound();

  const earliest = query.range === "all" ? await getEarliestRecordDate() : null;
  const range = parseDateRange(query, new Date(), { earliest });
  const report = await getReport(key, range);
  const lastDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);
  const symbol = currencySymbol();
  const basePath = `/admin/analytics/${key}`;

  // The same period, for the links to the other reports and the downloads.
  const period = new URLSearchParams();
  for (const name of ["range", "from", "to"] as const) if (query[name]) period.set(name, query[name]);
  const withPeriod = (path: string, extra?: Record<string, string>) => {
    const search = new URLSearchParams(period);
    for (const [name, value] of Object.entries(extra ?? {})) search.set(name, value);
    const text = search.toString();
    return text ? `${path}?${text}` : path;
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${reportLabels[key].description} Showing ${formatRangeDates(range.from, range.to)}.`}
        actions={
          <DateRangePicker
            // Remounts when the range changes, so the calendar opens on the new dates.
            key={`${key}-${range.preset}-${formatDateInput(range.from)}-${formatDateInput(lastDay)}`}
            basePath={basePath}
            preset={range.preset}
            from={formatDateInput(range.from)}
            to={formatDateInput(lastDay)}
          />
        }
      />

      <nav aria-label="Reports" className="mb-6 flex gap-1 overflow-x-auto border-b whitespace-nowrap">
        {reportKeys.map((item) => (
          <Link
            key={item}
            href={withPeriod(`/admin/analytics/${item}`)}
            aria-current={item === key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              item === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {reportLabels[item].title}
          </Link>
        ))}
      </nav>

      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", report.stats.length === 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "xl:grid-cols-4")}>
        {report.stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={formatCell(stat.value, symbol)}
            icon={icons[stat.icon] ?? Activity}
            tone={stat.tone}
            current={stat.current}
            previous={stat.previous}
            lowerIsBetter={stat.lowerIsBetter}
            note={stat.note}
          />
        ))}
      </div>

      {report.chart && (
        <section aria-label={report.chart.title} className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,42,92,0.04)]">
          <h2 className="text-base font-semibold text-slate-900">{report.chart.title}</h2>
          <p className="mt-0.5 mb-4 text-xs text-slate-500">
            Per {range.bucket === "month" ? "month" : "day"}. {report.chart.description}
          </p>
          {report.chart.points.every((p) => p.value === 0) ? (
            <p className="py-10 text-center text-sm text-slate-500">Nothing to show for this period.</p>
          ) : (
            <TimeChart
              points={report.chart.points}
              name={report.chart.name}
              type={report.chart.type}
              prefix={report.chart.money ? symbol : ""}
              color={report.chart.money ? "#10b981" : "#2563eb"}
              height={260}
            />
          )}
        </section>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4">
        {report.tables.map((table) => (
          <section key={table.key} aria-label={table.title} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,42,92,0.04)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-3xl">
                <h2 className="text-base font-semibold text-slate-900">{table.title}</h2>
                {table.description && <p className="mt-0.5 text-xs text-slate-500">{table.description}</p>}
              </div>
              {table.rows.length > 0 && (
                // A file download, so a plain link rather than a client-side route change.
                <Button variant="outline" size="sm" render={<a href={withPeriod(`${basePath}/export`, { table: table.key })} download />}>
                  <Download aria-hidden /> Download CSV
                </Button>
              )}
            </div>
            {table.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{table.empty}</p>
            ) : (
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full min-w-max text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {table.columns.map((column) => (
                        <th key={column.label} scope="col" className={cn("px-3 py-2 first:pl-0 last:pr-0", column.numeric && "text-right")}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {table.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, i) => (
                          <td
                            key={i}
                            className={cn(
                              "px-3 py-2 first:pl-0 last:pr-0",
                              table.columns[i].numeric ? "text-right text-slate-700 tabular-nums" : "max-w-xs truncate text-slate-900",
                              i === 0 && "font-medium",
                            )}
                          >
                            {formatCell(cell, symbol)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
