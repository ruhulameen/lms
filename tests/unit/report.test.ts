import { describe, expect, it } from "vitest";
import { formatCell, tableToCsv, type ReportTable } from "@/lib/report";

const table: ReportTable = {
  key: "courses",
  title: "Best-selling courses",
  columns: [{ label: "Course" }, { label: "Sold", numeric: true }, { label: "Revenue", numeric: true }, { label: "Share", numeric: true }],
  rows: [
    ['Excel, Word & "PowerPoint"', 3, { money: 1204.5 }, { percent: 42.456 }],
    ["=HYPERLINK(\"http://evil\")", 0, { money: 0 }, { percent: null }],
  ],
  empty: "",
};

describe("tableToCsv", () => {
  it("writes plain numbers, names the units in the heading and quotes awkward text", () => {
    expect(tableToCsv(table, "GBP").split("\r\n")).toEqual([
      "Course,Sold,Revenue (GBP),Share (%)",
      '"Excel, Word & ""PowerPoint""",3,1204.50,42.5',
      // A leading = would run as a formula in a spreadsheet.
      '"\'=HYPERLINK(""http://evil"")",0,0.00,',
      "",
    ]);
  });
});

describe("formatCell", () => {
  it("formats money, percentages, counts and gaps for the screen", () => {
    expect(formatCell({ money: 1204.5 }, "£")).toBe("£1,204.50");
    expect(formatCell({ percent: 42.456 }, "£")).toBe("42.5%");
    expect(formatCell({ percent: null }, "£")).toBe("–");
    expect(formatCell(12345, "£")).toBe("12,345");
    expect(formatCell(null, "£")).toBe("–");
  });
});
