import type { QueryResult } from "../types";

export function exportToCsv(result: QueryResult, filename = "query-result.csv") {
  const header = result.columns.map((c) => csvEscape(c.name)).join(",");
  const rows = result.rows.map((row) =>
    row
      .map((cell) => {
        if (cell === null || cell === undefined) return "";
        return csvEscape(String(cell));
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
