import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { readXlsx } from "./xlsx";
import { parseSheet } from "./parseSheet";
import { buildImportPlan, defaultDecisions } from "./plan";
import type { CatalogProduct, CatalogSchool } from "./types";

async function toBuffer(wb: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf as Uint8Array).buffer;
}

describe("spec 009 — leitura de .xlsx preserva o tipo de cada célula", () => {
  it("vazio, zero, texto, erro, fórmula sem resultado, data, mesclada e aba oculta", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Modalidade - UE");
    ws.getCell("A1").value = "CÓDIGO";
    ws.getCell("B1").value = 0;
    ws.getCell("C1").value = "1.000";
    ws.getCell("D1").value = { error: "#REF!" } as ExcelJS.CellErrorValue;
    ws.getCell("E1").value = { formula: "B1*2" } as ExcelJS.CellFormulaValue;
    ws.getCell("F1").value = { formula: "B1+1", result: 1 } as ExcelJS.CellFormulaValue;
    ws.getCell("G1").value = new Date(Date.UTC(2033, 1, 1));
    ws.getCell("H1").value = "Pedido";
    ws.mergeCells("H1:I1");
    const hidden = wb.addWorksheet("UE");
    hidden.state = "hidden";
    hidden.getCell("A1").value = "x";

    const raw = await readXlsx(await toBuffer(wb), "teste.xlsx");
    const [cells] = raw.sheets[0].rows;
    expect(cells[0]).toEqual({ t: "text", v: "CÓDIGO" });
    expect(cells[1]).toEqual({ t: "number", v: 0 });
    expect(cells[2]).toEqual({ t: "text", v: "1.000" });
    expect(cells[3]).toEqual({ t: "error", v: "#REF!" });
    expect(cells[4]).toEqual({ t: "formula_no_result", f: "B1*2" });
    expect(cells[5]).toEqual({ t: "number", v: 1 });
    expect(cells[6]).toEqual({ t: "date", v: "2033-02-01" });
    expect(cells[7]).toEqual({ t: "text", v: "Pedido" });
    expect(raw.sheets[1].hidden).toBe(true);
  });

  it("zero e vazio chegam diferentes ao plano (20 → 0 é possível, vazio não apaga)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedido");
    ws.addRow(["CÓDIGO", "ESCOLA", "Abacate", "Mel"]);
    ws.addRow(["1001", "ESCOLA A", 0, null]);
    const raw = await readXlsx(await toBuffer(wb), "zero.xlsx");
    const schools: CatalogSchool[] = [{ id: "s1", code: "1001", name: "ESCOLA A" }];
    const products: CatalogProduct[] = [
      { id: "p1", slug: "abacate", name: "Abacate", unit: "kg", offered: true },
      { id: "p2", slug: "mel", name: "Mel", unit: "kg", offered: true },
    ];
    const parsed = { fileName: raw.fileName, source: raw.source, sheets: raw.sheets.map((s) => parseSheet(s, schools, products)) };
    const plan = buildImportPlan(parsed, { ...defaultDecisions(parsed), unitConfirmed: true }, {
      schools,
      products,
      existingOrders: { "s1:p1": 20, "s1:p2": 4 },
      existingReturns: {},
    });
    expect(plan.lines).toEqual([{ schoolId: "s1", productId: "p1", newQty: 0, currentQty: 20, change: "ZERAR", sources: ["Pedido!C2"] }]);
  });
});

// Teste opcional contra o arquivo GZ real (anexo do prompt v2, não versionado).
// Rode com: GZ_XLSX_PATH=/caminho/Planilha_de_Pedido_22-06-2026_-_GZ_Alimentos.xlsx npx vitest run src/lib/import
const GZ = process.env.GZ_XLSX_PATH;
describe.skipIf(!GZ || !existsSync(GZ))("spec 009 — arquivo GZ real (opcional)", () => {
  it("reconhece as abas, os conflitos 2044/3016 e não importa Entrega", async () => {
    const seed = JSON.parse(readFileSync(new URL("../../../prisma/data/seed-data.json", import.meta.url), "utf8")) as {
      schools: { code: string; name: string }[];
      products: { slug: string; name: string }[];
    };
    const schools = seed.schools.map((s) => ({ id: `s${s.code}`, code: String(s.code), name: s.name }));
    const products = seed.products.map((p) => ({ id: p.slug, slug: p.slug, name: p.name, unit: (p.slug === "ovos" ? "dz" : "kg") as "kg" | "dz", offered: p.slug !== "ovos" }));
    const buf = readFileSync(GZ!);
    const raw = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "GZ.xlsx");
    const parsed = { fileName: raw.fileName, source: raw.source, sheets: raw.sheets.map((s) => parseSheet(s, schools, products)) };
    const kinds = Object.fromEntries(parsed.sheets.map((s) => [s.name, `${s.kind}${s.hidden ? " (oculta)" : ""}`]));
    expect(kinds).toEqual({
      "Modalidade - UE": "PEDIDOS",
      "Modalidade - UE Integral": "PEDIDOS",
      "Modalidade - EMEI": "PEDIDOS",
      "Modalidade - CEI": "PEDIDOS",
      TOTAL: "TOTALIZACAO",
      UE: "PEDIDOS (oculta)",
      EMEI: "VAZIA (oculta)",
      CEI: "VAZIA (oculta)",
    });
    const conflicts = parsed.sheets.flatMap((s) => s.rows.filter((r) => r.school.k === "NOME_DIVERGENTE").map((r) => `${s.name}:${r.rawCode}`));
    expect(conflicts).toEqual(expect.arrayContaining(["Modalidade - UE Integral:2044", "Modalidade - CEI:3016"]));
    const plan = buildImportPlan(parsed, { ...defaultDecisions(parsed), unitConfirmed: true }, { schools, products, existingOrders: {}, existingReturns: {} });
    expect(plan.reconciliation.selectedSheets).toHaveLength(4);
    expect(plan.lines.length).toBeGreaterThan(0);
    expect(plan.pending.some((p) => p.kind === "COLUNA_SUGESTAO")).toBe(true);
  }, 30_000);
});
