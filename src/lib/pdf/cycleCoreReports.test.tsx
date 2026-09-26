import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { executeCommand, type CycleCommand, type CycleLedger } from "../domain/cycleLedger";
import { DEMO_NAMES, buildDemoLedger } from "../cycleCore/demoScenario";
import { parseLedger } from "../cycleCore/ledgerSchema";
import { CYCLE_CORE_REPORTS, buildCycleCoreReport, type CycleCoreMeta, type CycleCoreReportKey } from "./cycleCoreReports";

const meta: CycleCoreMeta = {
  cycleLabel: "Ciclo de demonstração (dados fictícios)",
  status: "ABERTA",
  issuedAt: "29/09/2026 10:00",
  fileBase: "demonstracao",
  cycleCode: "DEMO",
  banner: "DEMONSTRAÇÃO — dados fictícios, nada foi gravado.",
};

function apply(ledger: CycleLedger, commands: CycleCommand[]): CycleLedger {
  let n = 0;
  for (const c of commands) {
    const r = executeCommand(ledger, c, { id: "t", role: "ADMIN" }, { now: "2026-09-29T10:00:00-03:00", newId: () => `x-${++n}` });
    if (!r.ok) throw new Error(r.error);
    ledger = r.ledger;
  }
  return ledger;
}

async function pdfText(ledger: CycleLedger, key: CycleCoreReportKey, options = {}, m = meta, names = DEMO_NAMES) {
  const { fileName, element } = buildCycleCoreReport(ledger, names, m, key, options);
  const buf = await renderToBuffer(element);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { fileName, pages: totalPages, text: (text as string[]).join("\n").replace(/\s+/g, " ") };
}

const withComplement = () =>
  apply(buildDemoLedger(), [
    { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "c", schoolId: "EA", productId: "alface", presentedQty: 30, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "P2" }, deliveredAt: "2026-09-29T14:10" },
  ]);

describe("PDFs pela lógica corrigida", () => {
  it("romaneios: inicial registrado com data/hora real, complemento em documento próprio, previsto em branco", async () => {
    const { text, pages, fileName } = await pdfText(withComplement(), "romaneios-escolas");
    expect(fileName).toBe("demonstracao-romaneios-escolas.pdf");
    // EA inicial + EA C1 + EB inicial + EB C1 + EC inicial + ED inicial
    expect(pages).toBe(6);
    expect(text).toContain("DEMONSTRAÇÃO — dados fictícios");
    expect(text).toContain("Documento DEMO-EA-C1");
    expect(text).toContain("Romaneio de complemento — Escola");
    expect(text).toContain("Data da entrega: 28/09/2026 | Horário da entrega: 09:40");
    expect(text).toContain("Data da entrega: 29/09/2026 | Horário da entrega: 14:10");
    expect(text).toContain("Data da entrega: ____/____/______ | Horário da entrega: ____:____");
    expect(text).toContain("Não substitui nem altera o romaneio da entrega inicial (DEMO-EA)");
  });

  it("romaneio de uma escola em 4 vias: mesmas entregas, só apresentação", async () => {
    const { pages, text, fileName } = await pdfText(withComplement(), "romaneios-escolas", { schoolId: "EA", copies: 4 });
    expect(fileName).toBe("demonstracao-romaneios-escolas-EA-4-vias.pdf");
    expect(pages).toBe(8);
    expect(text).toContain("Via 2 — Retorna com o caminhão");
  });

  it("entregas e atendimento: pendência como 'a conferir', situação por linha, total por unidade", async () => {
    const { text } = await pdfText(buildDemoLedger(), "entregas-escolas");
    expect(text).toContain("Entregas e Atendimento das Escolas");
    expect(text).toContain("Falta sem decisão");
    expect(text).toContain("Pendente de conferência");
    expect(text).toContain("a conferir");
    expect(text).toContain("TOTAL (kg)");
    expect(text).toContain("atendimento 75%");
  });

  it("diferenças: saldo a conferir e falta das escolas separados", async () => {
    const { text } = await pdfText(buildDemoLedger(), "diferenca");
    expect(text).toContain("Saldo a conferir");
    expect(text).toContain("Não é estoque nem perda");
  });

  it("balanço: a cobrar pelo aceito na escola, a pagar pelo aceito no galpão, indicadores e bloqueios", async () => {
    const { text } = await pdfText(buildDemoLedger(), "balanco");
    expect(text).toContain("NÃO · Pronto para fechar");
    expect(text).toContain("2.485,40"); // 170 × 14,62 (Escola Exemplo A)
    expect(text).toContain("1.971,00"); // 180 × 10,95 (Produtor Exemplo 1)
    expect(text).toContain("O que impede o fechamento");
    expect(text).toContain("não incluídos neste documento");
  });

  it("todos os documentos do núcleo geram PDF sem erro", async () => {
    for (const { key } of CYCLE_CORE_REPORTS) {
      const { pages } = await pdfText(withComplement(), key);
      expect(pages).toBeGreaterThan(0);
    }
  });

  // Opcional (lento): PDF_VOLUME=1 npx vitest run src/lib/pdf/cycleCoreReports.test.tsx
  it.skipIf(!process.env.PDF_VOLUME)("volume: 191 escolas × 10 produtos, com entregas e complementos", async () => {
    const schools = Array.from({ length: 191 }, (_, i) => `E${1000 + i}`);
    const products = Array.from({ length: 10 }, (_, i) => `prod${i}`);
    const names = {
      schools: Object.fromEntries(schools.map((s) => [s, `Escola Municipal de Nome Bem Comprido Número ${s}`])),
      products: Object.fromEntries(products.map((p) => [p, `Produto ${p}`])),
      producers: { P: "Produtor" },
    };
    const base: CycleLedger = {
      cycleId: "v",
      status: "ABERTO",
      orders: schools.flatMap((s) => products.map((p) => ({ schoolId: s, productId: p, orderedQty: 10, unit: "kg" as const, price: 5 }))),
      warehouseReceipts: products.map((p) => ({ producerId: "P", productId: p, grossQty: 2000, rejectedQty: 0, price: 5, logisticsDeductionSnapshot: 1 })),
      events: [],
      decisions: [],
      audit: [],
    };
    const commands: CycleCommand[] = schools.flatMap((s, si) =>
      products.map((p) => ({ type: "REGISTRAR_ENTREGA_INICIAL" as const, idempotencyKey: `${s}${p}`, schoolId: s, productId: p, presentedQty: si % 10 === 0 ? 8 : 10, rejectedQty: 0 })),
    );
    commands.push(...schools.filter((_, si) => si % 10 === 0).map((s) => ({ type: "REGISTRAR_COMPLEMENTO" as const, idempotencyKey: `c${s}`, schoolId: s, productId: "prod0", presentedQty: 2, rejectedQty: 0, source: { type: "SALDO_GALPAO" as const } })));
    const ledger = apply(base, commands);
    const timings: string[] = [];
    for (const key of ["entregas-escolas", "romaneios-escolas", "balanco"] as const) {
      const t0 = Date.now();
      const buf = await renderToBuffer(buildCycleCoreReport(ledger, names, meta, key).element);
      const ms = Date.now() - t0;
      const pages = (await getDocumentProxy(new Uint8Array(buf))).numPages;
      timings.push(`${key} ${pages} p. em ${ms} ms`);
      expect(ms).toBeLessThan(30_000);
      if (key === "entregas-escolas") expect(pages).toBe(69); // 1.910 linhas + total, sem quebra automática
      if (key === "romaneios-escolas") expect(pages).toBe(191 + 20); // 191 iniciais + 20 complementos
      if (key === "balanco") expect(pages).toBe(1 + Math.ceil(1910 / 36) + 1 + 1); // resumo + a cobrar + a pagar + faltas
    }
    console.log(`191 escolas: ${timings.join("; ")}`);
  }, 120_000);
});

describe("validação do registro recebido pela demonstração", () => {
  it("aceita o cenário (ida e volta em JSON) e descarta a auditoria", () => {
    const parsed = parseLedger(JSON.parse(JSON.stringify(withComplement())));
    expect(parsed?.events).toHaveLength(4);
    expect(parsed?.audit).toEqual([]);
  });

  it("recusa números negativos, identificadores estranhos e listas enormes", () => {
    const l = buildDemoLedger();
    expect(parseLedger({ ...l, orders: [{ ...l.orders[0], orderedQty: -1 }] })).toBeNull();
    expect(parseLedger({ ...l, orders: [{ ...l.orders[0], schoolId: "<script>" }] })).toBeNull();
    expect(parseLedger({ ...l, events: Array.from({ length: 20001 }, () => l.events[0]) })).toBeNull();
    expect(parseLedger(null)).toBeNull();
  });
});
