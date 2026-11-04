import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { readPdf } from "./pdf";
import { parseSheet } from "./parseSheet";
import { buildImportPlan, defaultDecisions, lineKey } from "./plan";
import { products, schools } from "./fixtures/gzLike";

const WIDTHS = [60, 200, 70, 70, 70];

function Row({ cells, bold }: { cells: string[]; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", borderBottom: "1pt solid #999", paddingVertical: 3 }}>
      {cells.map((c, i) => (
        <Text key={i} style={{ width: WIDTHS[i], fontSize: 9, fontWeight: bold ? 700 : 400, textAlign: i >= 2 ? "right" : "left", paddingRight: 6 }}>
          {c}
        </Text>
      ))}
    </View>
  );
}

// PDF fictício com o layout simples: cabeçalho repetido em cada página,
// subtotal no fim e números em texto (vírgula, milhar ambíguo, zero).
async function orderPdf(pages: string[][][]): Promise<ArrayBuffer> {
  const header = ["CÓDIGO", "ESCOLA", "Abacate", "Alface", "Cheiro verde"];
  const buf = await renderToBuffer(
    <Document>
      {pages.map((rows, i) => (
        <Page key={i} size="A4" orientation="landscape" style={{ padding: 30 }}>
          <Text style={{ fontSize: 12, marginBottom: 8 }}>Pedido de gêneros — página {i + 1}</Text>
          <Row cells={header} bold />
          {rows.map((r, k) => (
            <Row key={k} cells={r} />
          ))}
        </Page>
      ))}
    </Document>,
  );
  return new Uint8Array(buf).buffer;
}

describe("spec 009 — importação de PDF com texto", () => {
  it("reconstrói a tabela, trata cabeçalho repetido por página e subtotal, e reaproveita a prévia do Excel", async () => {
    const buffer = await orderPdf([
      [
        ["1001", "ESCOLA MUNICIPAL ABELARDO DE LAMARE", "10,5", "2", ""],
        ["1003", "ESCOLA MUNICIPAL BATAILLARD", "1.000", "", "0"],
      ],
      [
        ["2044", "ESCOLA DE EDUCAÇÃO INTEGRAL PADRE QUINHA", "4", "", ""],
        ["", "TOTAL", "1.014,5", "2", "0"],
      ],
    ]);
    const raw = await readPdf(buffer, "pedido.pdf");
    expect(raw.source).toBe("pdf");
    expect(raw.sheets.map((s) => s.name)).toEqual(["Página 1", "Página 2"]);

    const parsed = { fileName: raw.fileName, source: raw.source, sheets: raw.sheets.map((s) => parseSheet(s, schools, products)) };
    const [p1, p2] = parsed.sheets;
    expect(p1.kind).toBe("PEDIDOS");
    expect(p1.layout).toBe("SIMPLES");
    expect(p1.rows.map((r) => [r.rawCode, r.rawName])).toEqual([
      ["1001", "ESCOLA MUNICIPAL ABELARDO DE LAMARE"],
      ["1003", "ESCOLA MUNICIPAL BATAILLARD"],
    ]);
    expect(p2.ignoredRows.map((r) => r.reason)).toContain("Linha de total/subtotal.");
    expect(p2.rows[0].school.k).toBe("NOME_DIVERGENTE");

    const plan = buildImportPlan(parsed, { ...defaultDecisions(parsed), unitConfirmed: true }, {
      schools,
      products,
      existingOrders: { [lineKey("s-1003", "p-cheiro")]: 20 },
      existingReturns: {},
    });
    const line = (sid: string, pid: string) => plan.lines.find((l) => l.schoolId === sid && l.productId === pid);
    expect(line("s-1001", "p-abacate")?.newQty).toBe(10.5);
    expect(line("s-1003", "p-cheiro")).toMatchObject({ newQty: 0, change: "ZERAR" });
    expect(line("s-1003", "p-abacate")).toBeUndefined(); // "1.000" é ambíguo
    expect(plan.pending.map((p) => p.kind)).toEqual(expect.arrayContaining(["CELULA_AMBIGUA", "COLUNA_SUGESTAO", "ESCOLA_NOME_DIVERGENTE"]));
  }, 30_000);

  it("PDF sem texto (digitalizado) é recusado com explicação, nunca vira pedido vazio", async () => {
    const buf = await renderToBuffer(
      <Document>
        <Page size="A4">
          <View style={{ width: 100, height: 100, backgroundColor: "#ccc" }} />
        </Page>
      </Document>,
    );
    await expect(readPdf(new Uint8Array(buf).buffer, "scan.pdf")).rejects.toThrow(/não tem texto/);
  }, 30_000);
});
