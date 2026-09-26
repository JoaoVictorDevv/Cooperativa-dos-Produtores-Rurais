import { describe, expect, it } from "vitest";
import { executeCommand, type CycleCommand, type CycleLedger } from "../domain/cycleLedger";
import { DEMO_NAMES, buildDemoLedger } from "./demoScenario";
import {
  DOCUMENT_SOURCES,
  acceptedBalance,
  attendanceReport,
  differenceReport,
  eventRomaneios,
  lineSituation,
  methodologyOfRealCycle,
  schoolOrderRows,
  warehouseRows,
} from "./documents";

const names = DEMO_NAMES;
const admin = { id: "t", role: "ADMIN" as const };

function apply(ledger: CycleLedger, commands: CycleCommand[]): CycleLedger {
  let seq = 0;
  for (const c of commands) {
    const r = executeCommand(ledger, c, admin, { now: "2026-09-29T10:00:00-03:00", newId: () => `t-${++seq}` });
    if (!r.ok) throw new Error(r.error);
    ledger = r.ledger;
  }
  return ledger;
}

describe("documentos × metodologia", () => {
  it("ciclos reais continuam nos documentos do modelo atual; os sete tipos são preservados no novo modelo", () => {
    expect(methodologyOfRealCycle()).toBe("LEGADO_PEDIDO_MENOS_DEVOLUCAO");
    expect(Object.values(DOCUMENT_SOURCES.LEGADO_PEDIDO_MENOS_DEVOLUCAO).every((s) => s === "ATUAL")).toBe(true);
    expect(Object.keys(DOCUMENT_SOURCES.ACEITE_ESCOLAR)).toEqual(Object.keys(DOCUMENT_SOURCES.LEGADO_PEDIDO_MENOS_DEVOLUCAO));
    expect(DOCUMENT_SOURCES.ACEITE_ESCOLAR["pedido-produtores"]).toBe("ATUAL");
    expect(DOCUMENT_SOURCES.ACEITE_ESCOLAR.balanco).toBe("NUCLEO");
  });
});

describe("entregas e atendimento das escolas", () => {
  it("separa pedido, entregue, rejeição, perda, aceito, falta e excedente; pendente não vira zero", () => {
    const { rows, totals } = attendanceReport(buildDemoLedger(), names);
    const ea = rows.find((r) => r.schoolId === "EA")!;
    expect(ea).toMatchObject({ orderedQty: 200, presentedQty: 180, rejectedAtSchoolQty: 10, acceptedQty: 170, shortageQty: 30, situation: "Falta sem decisão", pending: false });
    expect(rows.find((r) => r.schoolId === "EB")).toMatchObject({ pending: true, situation: "Pendente de conferência", complementCount: 1 });
    expect(rows.find((r) => r.schoolId === "EC")).toMatchObject({ excessQty: 5, situation: "Atendido com excedente" });
    expect(totals).toHaveLength(1);
    // Atendimento: cada linha conta no máximo o próprio pedido — o excedente de EC não cobre a falta de EA.
    // (170 + 20 + 50 + 0) / (200 + 30 + 50 + 40) = 75%
    expect(totals[0]).toMatchObject({ unit: "kg", orderedQty: 320, excessQty: 5, attendancePercent: 75, shortageQty: 30, pendingLines: 2 });
  });

  it("falta encerrada aparece com motivo e situação própria, não como atendida", () => {
    const l = apply(buildDemoLedger(), [{ type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "EA", productId: "alface", reason: "Sem alface", expectedShortageQty: 30, expectedVersion: null }]);
    const ea = attendanceReport(l, names).rows.find((r) => r.schoolId === "EA")!;
    expect(ea).toMatchObject({ situation: "Falta encerrada sem atendimento", decisionReason: "Sem alface" });
    expect(attendanceReport(l, names).totals[0].shortageClosedQty).toBe(30);
  });

  it("situação nunca é um OK único", () => {
    expect(lineSituation({ receiptStatus: "CONFERIDO", shortageStatus: "NAO_APLICAVEL", excessQty: 0 } as never)).toBe("Atendido");
  });
});

describe("romaneios por evento", () => {
  it("romaneio inicial previsto sai em branco; complemento tem romaneio próprio e não altera o inicial", () => {
    const docs = eventRomaneios(buildDemoLedger(), names, "S1");
    const eb = docs.filter((d) => d.schoolId === "EB");
    expect(eb.map((d) => [d.docNumber, d.kind, d.mode])).toEqual([
      ["S1-EB", "INICIAL", "PREVISTO"],
      ["S1-EB-C1", "COMPLEMENTO", "REGISTRADO"],
    ]);
    expect(eb[0].lines[0]).toMatchObject({ orderedQty: 30, presentedQty: null, rejectedQty: null, acceptedQty: null });
    expect(eb[1].lines[0]).toMatchObject({ orderedQty: 30, acceptedBeforeQty: 0, presentedQty: 20, acceptedQty: 20, source: "Produtor Exemplo 3" });
    const ed = docs.filter((d) => d.schoolId === "ED");
    expect(ed).toHaveLength(1);
    expect(ed[0].mode).toBe("PREVISTO");
  });

  it("depois de registrada, a entrega inicial sai conforme registro; complementos posteriores mostram o aceito antes", () => {
    const l = apply(buildDemoLedger(), [
      { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "c1", schoolId: "EA", productId: "alface", presentedQty: 20, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "P2" }, deliveredAt: "2026-09-29T14:00" },
      { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "c2", schoolId: "EA", productId: "alface", presentedQty: 10, rejectedQty: 0, source: { type: "SALDO_GALPAO" }, deliveredAt: "2026-09-30T08:00" },
    ]);
    const ea = eventRomaneios(l, names, "S1", "EA");
    expect(ea.map((d) => d.docNumber)).toEqual(["S1-EA", "S1-EA-C1", "S1-EA-C2"]);
    expect(ea[0]).toMatchObject({ mode: "REGISTRADO", deliveredAt: "2026-09-28T09:40", receivedBy: "Merendeira (exemplo)" });
    expect(ea[0].lines[0]).toMatchObject({ presentedQty: 180, rejectedQty: 10, acceptedQty: 170 });
    expect(ea[0].lines[0].reason).toMatch(/Produto murcho/);
    expect(ea[1].lines[0]).toMatchObject({ acceptedBeforeQty: 170, acceptedQty: 20 });
    expect(ea[2].lines[0]).toMatchObject({ acceptedBeforeQty: 190, acceptedQty: 10, source: "saldo do galpão" });
  });

  it("complementos da mesma escola com a mesma data/hora saem no mesmo romaneio", () => {
    const l = apply(buildDemoLedger(), [
      { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "i", schoolId: "ED", productId: "alface", presentedQty: 30, rejectedQty: 0 },
      { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "a", schoolId: "EA", productId: "alface", presentedQty: 5, rejectedQty: 0, source: { type: "SALDO_GALPAO" }, deliveredAt: "2026-09-29T14:00" },
    ]);
    const multi: CycleLedger = { ...l, orders: [...l.orders, { schoolId: "EA", productId: "couve", orderedQty: 10, unit: "kg", price: 8.1 }] };
    const l2 = apply(multi, [{ type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "b", schoolId: "EA", productId: "couve", presentedQty: 10, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "P3" }, deliveredAt: "2026-09-29T14:00" }]);
    const c = eventRomaneios(l2, names, "S1", "EA").filter((d) => d.kind === "COMPLEMENTO");
    expect(c).toHaveLength(1);
    expect(c[0].lines.map((x) => x.productId)).toEqual(["alface", "couve"]);
  });
});

describe("galpão, diferenças e balanço pelo aceito", () => {
  it("galpão: bruto − rejeição = aceito, a pagar pelo preço líquido congelado", () => {
    const rows = warehouseRows(buildDemoLedger(), names);
    expect(rows.find((r) => r[0] === "Produtor Exemplo 1" && r[1] === "Alface lisa")).toEqual(["Produtor Exemplo 1", "Alface lisa", "200 kg", "20", "180", expect.stringContaining("10,95"), expect.stringContaining("1.971,00")]);
  });

  it("diferença por produto: saldo a conferir = aceito no galpão − entregue às escolas − perda; falta das escolas à parte", () => {
    const alface = differenceReport(buildDemoLedger(), names).find((r) => r.productId === "alface")!;
    // galpão aceitou 180 (P1) + 70 (P2) = 250; escolas receberam 180; pedidos 240.
    // Falta conferida só de EA (30); ED ainda não foi conferida e fica à parte (não é falta de 40).
    expect(alface).toMatchObject({ orderedBySchools: 240, acceptedAtWarehouse: 250, presentedToSchools: 180, balanceToCheck: 70, shortageAtSchools: 30, pendingLines: 1 });
  });

  it("balanço cobra pelo aceito na escola e paga pelo aceito no galpão; bloqueios visíveis", () => {
    const b = acceptedBalance(buildDemoLedger(), names);
    expect(b.indicators).toEqual({ receiptsConferred: false, valuesCalculated: false, readyToClose: false });
    expect(b.receivableRows.find((r) => r[0] === "Escola Exemplo A")).toEqual(["Escola Exemplo A", "Alface lisa", "170 kg", expect.stringContaining("14,62"), expect.stringContaining("2.485,40")]);
    expect(b.preview.blockers.length).toBeGreaterThan(0);
  });

  it("pedido das escolas lista só pedidos > 0, com unidade", () => {
    expect(schoolOrderRows(buildDemoLedger(), names)[0]).toEqual(["Escola Exemplo A", "Alface lisa", "200 kg"]);
  });
});
