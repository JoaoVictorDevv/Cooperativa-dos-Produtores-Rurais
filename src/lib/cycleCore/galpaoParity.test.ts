import { describe, expect, it } from "vitest";
import type { CycleLedger } from "../domain/cycleLedger";
import { compareGalpao, parityMarkdown, type LegacyGalpao } from "./galpaoParity";

const ledger: CycleLedger = {
  cycleId: "c",
  status: "FECHADO",
  orders: [{ schoolId: "s", productId: "alface", orderedQty: 200, unit: "kg", price: 14.62 }],
  warehouseReceipts: [{ producerId: "p", productId: "alface", grossQty: 200, rejectedQty: 20, unit: "kg", price: 14.62, logisticsDeductionSnapshot: 3.67 }],
  events: [],
  decisions: [],
  audit: [],
};
const current = { ledger, names: { schools: {}, products: { alface: "Alface" }, producers: { p: "Produtor" } }, costs: [{ amount: 100 }], returnsWithoutDelivery: [] };
const legacy: LegacyGalpao = {
  producerLines: [{ producerId: "p", productId: "alface", deliveredQty: 200, returnedQty: 20, netQty: 180, payment: 1971 }],
  producersTotal: 1971,
  totalCosts: 100,
  differenceLines: [{ productId: "alface", orderedQty: 200, netDeliveredQty: 180, difference: -20 }],
  treasuryTotal: 2777.8,
  treasuryRounding: "TOTAL_LEGADO",
};

describe("comparação do galpão (modelo atual × lógica corrigida)", () => {
  it("números iguais: OK, e a cobrança escolar fica explicitamente como não validada", () => {
    const r = compareGalpao(legacy, current);
    expect(r.ok).toBe(true);
    expect(r.notValidated[0]).toMatch(/sem base/);
    expect(parityMarkdown(r, "t")).toContain("Resultado: OK");
  });

  it("acusa divergência de pagamento, de custo e de diferença", () => {
    const r = compareGalpao(
      { ...legacy, producerLines: [{ ...legacy.producerLines[0], payment: 1970.99 }], totalCosts: 90, differenceLines: [{ ...legacy.differenceLines[0], orderedQty: 210, difference: -30 }] },
      current,
    );
    expect(r.ok).toBe(false);
    expect(r.mismatches.map((m) => m.label)).toEqual(["Produtor — Alface: a pagar", "Custos reais registrados", "Alface: pedido das escolas", "Alface: diferença (líquido − pedido)"]);
    expect(parityMarkdown(r, "t")).toContain("DIVERGE · Produtor — Alface: a pagar: atual 1970.99 × núcleo 1971");
  });

  it("acusa lançamento que existe só de um lado", () => {
    const r = compareGalpao({ ...legacy, producerLines: [...legacy.producerLines, { ...legacy.producerLines[0], producerId: "q" }] }, current);
    expect(r.anomalies.join(" ")).toMatch(/não foi encontrado no núcleo/);
  });
});
