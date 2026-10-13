import { parseDateRange } from "@/lib/date-range";
import { tableToCsv } from "@/lib/report";
import { getSettings } from "@/lib/settings-store";
import { getEarliestRecordDate } from "@/services/dashboard";
import { getReport, isReportKey } from "@/services/reports";
import { can, getCurrentUser } from "@/services/user";

// One table of a report as a CSV file, for the period in the address:
// /admin/analytics/sales/export?table=courses&range=last-30-days
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (!can(user, "analytics.view")) return new Response("You do not have permission to do that.", { status: 403 });

  const { report: key } = await params;
  if (!isReportKey(key)) return new Response("No such report.", { status: 404 });

  const search = new URL(request.url).searchParams;
  const query = { range: search.get("range") ?? undefined, from: search.get("from") ?? undefined, to: search.get("to") ?? undefined };
  const earliest = query.range === "all" ? await getEarliestRecordDate() : null;
  const range = parseDateRange(query, new Date(), { earliest });

  const table = (await getReport(key, range)).tables.find((t) => t.key === search.get("table"));
  if (!table) return new Response("No such table.", { status: 404 });

  const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const lastDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);
  const filename = `${key}-${table.key}-${day(range.from)}-to-${day(lastDay)}.csv`;

  // The byte order mark makes Excel read the file as UTF-8 (currency signs, names).
  return new Response(`﻿${tableToCsv(table, getSettings().payment.currency)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
