// Leitura de .xlsx para a grade neutra da importação. Só roda no servidor.
// Preserva a diferença entre vazio, zero, texto, erro e fórmula sem
// resultado — nada disso vira zero aqui.

import ExcelJS from "exceljs";
import type { RawCell, RawSheet, RawWorkbook } from "./types";

function toRawCell(cell: ExcelJS.Cell): RawCell {
  if (cell.type === ExcelJS.ValueType.Merge && cell.master !== cell) return { t: "merged" };
  const v = cell.value;
  if (v === null || v === undefined) return { t: "empty" };
  if (typeof v === "number") return { t: "number", v };
  if (typeof v === "string") return v.trim() === "" ? { t: "empty" } : { t: "text", v };
  if (typeof v === "boolean") return { t: "bool", v };
  if (v instanceof Date) return { t: "date", v: v.toISOString().slice(0, 10) };
  if (typeof v === "object") {
    if ("error" in v) return { t: "error", v: String(v.error) };
    if ("richText" in v) {
      const text = v.richText.map((t) => t.text).join("");
      return text.trim() === "" ? { t: "empty" } : { t: "text", v: text };
    }
    if ("formula" in v || "sharedFormula" in v) {
      const formula = "formula" in v && v.formula ? v.formula : "sharedFormula" in v ? String(v.sharedFormula) : "";
      const result = (v as { result?: unknown }).result;
      if (result === undefined || result === null) return { t: "formula_no_result", f: formula };
      if (typeof result === "number") return { t: "number", v: result };
      if (typeof result === "string") return result.trim() === "" ? { t: "empty" } : { t: "text", v: result };
      if (typeof result === "boolean") return { t: "bool", v: result };
      if (result instanceof Date) return { t: "date", v: result.toISOString().slice(0, 10) };
      if (typeof result === "object" && result && "error" in result) return { t: "error", v: String((result as { error: unknown }).error) };
      return { t: "formula_no_result", f: formula };
    }
    if ("text" in v) return { t: "text", v: String(v.text) };
  }
  return { t: "text", v: String(v) };
}

function sheetToRaw(ws: ExcelJS.Worksheet): RawSheet {
  const rows: RawCell[][] = [];
  let lastNonEmpty = -1;
  const maxCol = Math.min(ws.columnCount, 200);
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: RawCell[] = [];
    let lastCol = -1;
    for (let c = 1; c <= maxCol; c++) {
      const raw = toRawCell(row.getCell(c));
      cells.push(raw);
      if (raw.t !== "empty" && raw.t !== "merged") lastCol = c - 1;
    }
    rows.push(cells.slice(0, lastCol + 1));
    if (lastCol >= 0) lastNonEmpty = r - 1;
  }
  return { name: ws.name, hidden: ws.state !== "visible", rows: rows.slice(0, lastNonEmpty + 1) };
}

export async function readXlsx(buffer: ArrayBuffer, fileName: string): Promise<RawWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return { fileName, source: "xlsx", sheets: workbook.worksheets.map(sheetToRaw) };
}
