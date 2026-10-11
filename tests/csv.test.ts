import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, parseSheetDate } from "@/lib/csv";

describe("csv", () => {
  it("parses quotes, commas and newlines inside fields", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n"l1\nl2",z\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["l1\nl2", "z"]]);
  });
  it("round-trips", () => {
    const rows = [["a", "b,c"], ['q"q', "n\nn"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("parses sheet dates", () => {
    expect(parseSheetDate("2026-10-15 16:00:00 +0530", "UTC")).toBe("2026-10-15T10:30:00.000Z");
    expect(parseSheetDate("2026-10-15 16:00:00", "IST")).toBe("2026-10-15T10:30:00.000Z");
    expect(parseSheetDate("2026-10-09 5:54:51", "UTC")).toBe("2026-10-09T05:54:51.000Z");
    expect(parseSheetDate("garbage", "UTC")).toBeNull();
    expect(parseSheetDate("", "UTC")).toBeNull();
  });
});
