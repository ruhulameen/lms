// The shape every report under /admin/analytics has, and how its cells are
// shown on screen and written to a CSV file. Pure, shared by the page, the
// export route and the unit tests.

export const reportKeys = ["sales", "courses", "learners", "marketing"] as const;
export type ReportKey = (typeof reportKeys)[number];

export const reportLabels: Record<ReportKey, { title: string; description: string }> = {
  sales: { title: "Sales", description: "Revenue, orders, refunds, best sellers and coupons." },
  courses: { title: "Courses", description: "Enrolments, completion, where learners stop, quizzes and ratings." },
  learners: { title: "Learners", description: "Sign-ups, who is studying, who buys and who comes back." },
  marketing: { title: "Marketing", description: "Which sources and campaigns bring sign-ups and sales." },
};

// A table or headline value: text, a count, an amount of money in the site
// currency, a percentage (null when there is nothing to divide by), or empty.
export type Cell = string | number | { money: number } | { percent: number | null } | null;

export type ReportStat = {
  label: string;
  value: Cell;
  icon: string;
  tone: "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";
  // With both, the card shows the change against the previous period.
  current?: number;
  previous?: number | null;
  lowerIsBetter?: boolean;
  note?: string;
};

export type ReportTable = {
  // Names the table in the export address.
  key: string;
  title: string;
  description?: string;
  columns: { label: string; numeric?: boolean }[];
  rows: Cell[][];
  empty: string;
};

export type Report = {
  stats: ReportStat[];
  chart?: { title: string; description: string; name: string; money: boolean; type: "area" | "column"; points: { label: string; value: number }[] };
  tables: ReportTable[];
};

const EMPTY = "–";

// As shown on screen: "£1,204.50", "42.5%", "1,204".
export function formatCell(cell: Cell, symbol: string) {
  if (cell === null) return EMPTY;
  if (typeof cell === "string") return cell;
  if (typeof cell === "number") return cell.toLocaleString("en-GB");
  if ("money" in cell) return `${symbol}${cell.money.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return cell.percent === null ? EMPTY : `${cell.percent.toFixed(1)}%`;
}

// As written to a file: plain numbers a spreadsheet can add up.
function csvValue(cell: Cell) {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "string") {
    // A cell starting with one of these is run as a formula by spreadsheets.
    const text = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  if ("money" in cell) return cell.money.toFixed(2);
  return cell.percent === null ? "" : cell.percent.toFixed(1);
}

// One table as CSV text. Money and percentage columns say so in their heading.
export function tableToCsv(table: ReportTable, currency: string) {
  const sample = (index: number) => table.rows.map((row) => row[index]).find((cell) => cell !== null && typeof cell === "object");
  const heading = table.columns.map((column, index) => {
    const cell = sample(index);
    const unit = cell && "money" in cell ? ` (${currency})` : cell && "percent" in cell ? " (%)" : "";
    return csvValue(`${column.label}${unit}`);
  });
  return [heading, ...table.rows.map((row) => row.map(csvValue))].map((row) => row.join(",")).join("\r\n") + "\r\n";
}
