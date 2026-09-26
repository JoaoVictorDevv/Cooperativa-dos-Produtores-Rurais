import { describe, expect, it } from "vitest";
import { parseSheet } from "./parseSheet";
import { buildImportPlan, defaultDecisions, lineKey, planSignature, type ImportDecisions, type PlanContext } from "./plan";
import { parseQtyText } from "./text";
import { E, gzLikeWorkbook, n, products, s, schoolRow, schools, modalitySheet } from "./fixtures/gzLike";
import type { ParsedWorkbook, RawSheet, RawWorkbook } from "./types";

function parse(wb: RawWorkbook): ParsedWorkbook {
  return { fileName: wb.fileName, source: wb.source, sheets: wb.sheets.map((sh) => parseSheet(sh, schools, products)) };
}

const emptyCtx: PlanContext = { schools, products, existingOrders: {}, existingReturns: {} };

function plan(parsed: ParsedWorkbook, patch: Partial<ImportDecisions> = {}, ctx: Partial<PlanContext> = {}) {
  return buildImportPlan(parsed, { ...defaultDecisions(parsed), unitConfirmed: true, ...patch }, { ...emptyCtx, ...ctx });
}

const line = (p: ReturnType<typeof plan>, schoolId: string, productId: string) =>
  p.lines.find((l) => l.schoolId === schoolId && l.productId === productId);

describe("spec 009 — reconhecimento das abas no formato GZ", () => {
  const parsed = parse(gzLikeWorkbook());
  const byName = (name: string) => parsed.sheets.find((sh) => sh.name === name)!;

  it("abas de modalidade são pedidos com cabeçalho em 2 linhas, código em A e nome em B", () => {
    const ue = byName("Modalidade - UE");
    expect(ue.kind).toBe("PEDIDOS");
    expect(ue.layout).toBe("PEDIDO_ENTREGA");
    expect(ue.headerRows).toEqual([1, 2]);
    expect(ue.codeCol).toBe("A");
    expect(ue.nameCol).toBe("B");
    expect(ue.updateMarker).toBe("Atualização 12/04/2022");
    expect(ue.otherColumnsIgnored).toEqual([{ letter: "C", label: "Número de Atendimentos" }]);
  });

  it("só colunas de Pedido são candidatas; Entrega é ignorada e contada", () => {
    const ue = byName("Modalidade - UE");
    expect(ue.columns.map((c) => c.letter)).toEqual(["D", "F", "H", "J", "L"]);
    expect(ue.deliveryColumnsIgnored).toBe(5);
  });

  it("TOTAL é totalização; aba oculta antiga e aba vazia ficam fora da seleção padrão", () => {
    expect(byName("TOTAL").kind).toBe("TOTALIZACAO");
    expect(byName("UE").hidden).toBe(true);
    expect(byName("CEI").kind).toBe("VAZIA");
    expect(defaultDecisions(parsed).selectedSheets).toEqual(["Modalidade - UE", "Modalidade - UE Integral", "Modalidade - CEI"]);
  });

  it("linhas de parâmetro, subtotal e texto solto não viram escola", () => {
    const ue = byName("Modalidade - UE");
    expect(ue.ignoredRows.map((r) => r.row)).toEqual([3, 5, 9]);
    expect(ue.unrecognizedRows).toEqual([{ row: 8, text: "GAE | GERÊNCIA DE ALIMENTAÇÃO ESCOLAR" }]);
    expect(ue.rows.map((r) => r.rawCode)).toEqual(["1001", "1003"]);
  });

  it("produtos: exato é automático; genérico exige confirmação; Ovo fica fora da oferta; desconhecido fica fora", () => {
    const [abacate, alface, cheiro, ovo, abacaxi] = byName("Modalidade - UE").columns;
    expect(abacate.match).toEqual({ kind: "AUTO", productId: "p-abacate" });
    expect(alface.match).toEqual({ kind: "SUGESTAO", candidateIds: ["p-alface"] });
    expect(cheiro.match).toEqual({ kind: "AUTO", productId: "p-cheiro" });
    expect(ovo.match).toEqual({ kind: "FORA_DA_OFERTA", retiredProductId: "p-ovos" });
    expect(abacaxi.match).toEqual({ kind: "NAO_RECONHECIDA" });
  });

  it("'Couve' sugere Couve manteiga e Couve-flor, sem escolher", () => {
    const sheet = parseSheet(
      { name: "x", hidden: false, rows: [[E, E, s("Pedido"), s("Entrega")], [s("ESCOLA"), s("ESCOLA"), s("Couve"), s("Couve")], [n(1001), s("ABELARDO"), n(3), n(3)]] },
      schools,
      products,
    );
    expect(sheet.columns[0].match).toEqual({ kind: "SUGESTAO", candidateIds: ["p-couve", "p-couveflor"] });
  });

  it("conflitos conhecidos: 2044 (Padre Quinha × Santo Antônio) e 3016 (Soroptimista × Pedras Brancas)", () => {
    const [padreQuinha] = byName("Modalidade - UE Integral").rows;
    const [soroptimista] = byName("Modalidade - CEI").rows;
    expect(padreQuinha.school).toEqual({ k: "NOME_DIVERGENTE", schoolId: "s-2044" });
    expect(soroptimista.school).toEqual({ k: "NOME_DIVERGENTE", schoolId: "s-3016" });
  });

  it("abreviação não é conflito (E.M. BATAILLARD × ESCOLA MUNICIPAL BATAILLARD)", () => {
    expect(byName("Modalidade - UE").rows[1].school).toEqual({ k: "OK", schoolId: "s-1003" });
  });

  it("código com sufixo (1096.1) não é associado a 1096 sozinho — só sugerido", () => {
    const row = byName("Modalidade - UE Integral").rows[1];
    expect(row.school).toEqual({ k: "DESCONHECIDA", suggestionIds: ["s-1096"] });
  });

  it("código formatado como data vira pendência com sugestão pelo nome, não é descartado", () => {
    const row = byName("Modalidade - CEI").rows[1];
    expect(row.school.k).toBe("CODIGO_ILEGIVEL");
  });
});

describe("spec 009 — plano de gravação (padrões seguros)", () => {
  const parsed = parse(gzLikeWorkbook());
  const p = plan(parsed);

  it("importa só o que está reconhecido; Entrega (valores +1000) nunca aparece", () => {
    expect(line(p, "s-1001", "p-abacate")?.newQty).toBe(8);
    expect(line(p, "s-1003", "p-abacate")?.newQty).toBe(10);
    expect(p.lines.every((l) => l.newQty < 1000)).toBe(true);
  });

  it("valor com ruído binário (1.7999999999999998) é 1,8, não pendência de precisão", () => {
    expect(line(p, "s-1001", "p-cheiro")?.newQty).toBe(1.8);
  });

  it("nada entra de coluna genérica não confirmada, de escola com conflito ou desconhecida", () => {
    expect(p.lines.some((l) => l.productId === "p-alface")).toBe(false);
    expect(p.lines.some((l) => l.schoolId === "s-2044" || l.schoolId === "s-3016" || l.schoolId === "s-1096")).toBe(false);
    const kinds = p.pending.map((x) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["COLUNA_SUGESTAO", "ESCOLA_NOME_DIVERGENTE", "ESCOLA_DESCONHECIDA", "CODIGO_ILEGIVEL"]));
  });

  it("importação parcial exige ciência explícita", () => {
    expect(p.canConfirm).toBe(false);
    expect(p.confirmBlockers.join(" ")).toMatch(/importação parcial/);
    const ok = plan(parsed, { acknowledgeExclusions: true });
    expect(ok.canConfirm).toBe(true);
  });

  it("sem unidade no cabeçalho, a confirmação da unidade é obrigatória", () => {
    const semConfirmar = buildImportPlan(parsed, { ...defaultDecisions(parsed), acknowledgeExclusions: true }, emptyCtx);
    expect(semConfirmar.pending.find((x) => x.kind === "UNIDADE_NAO_CONFIRMADA")?.blocking).toBe(true);
    expect(semConfirmar.canConfirm).toBe(false);
  });

  it("reconciliação separa origem, fora da oferta, oferecido, pendente e confirmado", () => {
    const r = p.reconciliation;
    expect(r.sourceCells).toBe(r.outOfOfferCells + r.pendingCells + r.excludedByDecisionCells + r.importedCells);
    expect(r.offeredCells).toBeLessThanOrEqual(r.sourceCells - r.outOfOfferCells);
    expect(r.outOfOfferCells).toBeGreaterThan(0);
    expect(r.importedCells).toBeGreaterThan(0);
    expect(r.confirmedLines).toBe(p.lines.filter((l) => l.change !== "SEM_MUDANCA").length);
  });
});

describe("spec 009 — decisões explícitas", () => {
  const parsed = parse(gzLikeWorkbook());

  it("confirmar 'Alface' como Alface lisa passa a importar a coluna", () => {
    const p = plan(parsed, { columnProduct: { "Modalidade - UE!F": "p-alface" } });
    expect(line(p, "s-1001", "p-alface")?.newQty).toBe(2);
    expect(line(p, "s-1003", "p-alface")?.newQty).toBe(2.5);
  });

  it("confirmar o conflito 2044 importa para a escola do cadastro; excluir tira a pendência", () => {
    const confirmado = plan(parsed, { rowSchool: { "Modalidade - UE Integral!6": "s-2044" } });
    expect(line(confirmado, "s-2044", "p-abacate")?.newQty).toBe(4);
    const excluido = plan(parsed, { rowSchool: { "Modalidade - UE Integral!6": null } });
    expect(excluido.pending.some((x) => x.kind === "ESCOLA_NOME_DIVERGENTE" && x.sheet === "Modalidade - UE Integral")).toBe(false);
    expect(excluido.reconciliation.schoolRows.excluded).toBe(1);
  });

  it("associar 1096.1 a 1096 é uma decisão explícita", () => {
    const p = plan(parsed, { rowSchool: { "Modalidade - UE Integral!7": "s-1096" } });
    expect(line(p, "s-1096", "p-abacate")?.newQty).toBe(3);
  });

  it("mais de 2 casas decimais só entra com a regra de arredondamento aceita", () => {
    const conflito = { "Modalidade - CEI!6": "s-3016" };
    const semRegra = plan(parsed, { rowSchool: conflito });
    expect(line(semRegra, "s-3016", "p-abacate")).toBeUndefined();
    expect(semRegra.pending.find((x) => x.kind === "CELULA_PRECISAO")?.message).toMatch(/7.568.*7.57/);
    const comRegra = plan(parsed, { rowSchool: conflito, acceptRounding: true });
    expect(line(comRegra, "s-3016", "p-abacate")?.newQty).toBe(7.57);
  });

  it("fórmula sem resultado é pendência, nunca zero", () => {
    const p = plan(parsed, { rowSchool: { "Modalidade - CEI!6": "s-3016" }, columnProduct: { "Modalidade - CEI!F": "p-alface" } });
    expect(line(p, "s-3016", "p-alface")).toBeUndefined();
    expect(p.pending.find((x) => x.kind === "CELULA_INVALIDA")?.message).toMatch(/Fórmula sem resultado/);
  });

  it("selecionar também a aba oculta antiga gera escola duplicada que exige decisão", () => {
    const selectedSheets = ["Modalidade - UE", "UE"];
    const pendente = plan(parsed, { selectedSheets });
    expect(pendente.pending.some((x) => x.kind === "ESCOLA_DUPLICADA")).toBe(true);
    expect(line(pendente, "s-1001", "p-abacate")).toBeUndefined();
    const somar = plan(parsed, { selectedSheets, duplicateSchool: { "s-1001": "SOMAR" } });
    expect(line(somar, "s-1001", "p-abacate")?.newQty).toBe(107);
    const soUma = plan(parsed, { selectedSheets, duplicateSchool: { "s-1001": "Modalidade - UE!6" } });
    expect(line(soUma, "s-1001", "p-abacate")?.newQty).toBe(8);
  });
});

function simpleSheet(rows: (string | number | null)[][]): RawSheet {
  const cell = (v: string | number | null) => (v === null ? E : typeof v === "number" ? n(v) : s(v));
  return { name: "Pedido", hidden: false, rows: rows.map((r) => r.map(cell)) };
}

function simpleWorkbook(rows: (string | number | null)[][]): ParsedWorkbook {
  return parse({ fileName: "simples.xlsx", source: "xlsx", sheets: [simpleSheet(rows)] });
}

describe("spec 009 — problemas apontados no motor antigo", () => {
  it("zero explícito atualiza 20 para 0; vazio não apaga", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate", "Cheiro verde"],
      ["1001", "ABELARDO DE LAMARE", 0, null],
    ]);
    const p = plan(parsed, {}, {
      existingOrders: { [lineKey("s-1001", "p-abacate")]: 20, [lineKey("s-1001", "p-cheiro")]: 5 },
    });
    expect(line(p, "s-1001", "p-abacate")).toMatchObject({ newQty: 0, currentQty: 20, change: "ZERAR" });
    expect(line(p, "s-1001", "p-cheiro")).toBeUndefined();
  });

  it("'1.000' textual é ambíguo: nada é gravado até escolher 1 ou 1000", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["1001", "ABELARDO", "1.000"],
    ]);
    expect(parsed.sheets[0].rows[0].cells[0]).toEqual({ k: "AMBIGUO", text: "1.000", options: [1, 1000] });
    const pendente = plan(parsed);
    expect(line(pendente, "s-1001", "p-abacate")).toBeUndefined();
    expect(pendente.pending[0].kind).toBe("CELULA_AMBIGUA");
    const escolhido = plan(parsed, { cellValue: { "Pedido!C2": 1000 } });
    expect(line(escolhido, "s-1001", "p-abacate")?.newQty).toBe(1000);
  });

  it("número de célula (não texto) não é ambíguo: 1000 é 1000", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["1001", "ABELARDO", 1000],
    ]);
    expect(line(plan(parsed), "s-1001", "p-abacate")?.newQty).toBe(1000);
  });

  it("duas colunas do mesmo produto exigem decisão e nenhuma sobrescreve a outra", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate", "ABACATE"],
      ["1001", "ABELARDO", 5, 7],
    ]);
    const pendente = plan(parsed);
    expect(pendente.pending.map((x) => x.kind)).toContain("COLUNA_DUPLICADA");
    expect(line(pendente, "s-1001", "p-abacate")).toBeUndefined();
    const decidido = plan(parsed, { columnProduct: { "Pedido!D": null } });
    expect(line(decidido, "s-1001", "p-abacate")?.newQty).toBe(5);
  });

  it("código igual com nome de outra escola exige revisão", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["2044", "PADRE QUINHA", 5],
    ]);
    expect(parsed.sheets[0].rows[0].school.k).toBe("NOME_DIVERGENTE");
  });

  it("unidade diferente no cabeçalho não é convertida", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate (cx)", "Cheiro verde (kg)"],
      ["1001", "ABELARDO", 2, 3],
    ]);
    const p = buildImportPlan(parsed, { ...defaultDecisions(parsed), acknowledgeExclusions: true }, emptyCtx);
    expect(line(p, "s-1001", "p-abacate")).toBeUndefined();
    expect(p.pending.map((x) => x.kind)).toContain("COLUNA_UNIDADE");
    expect(line(p, "s-1001", "p-cheiro")?.newQty).toBe(3);
    expect(p.pending.map((x) => x.kind)).not.toContain("UNIDADE_NAO_CONFIRMADA");
  });

  it("erro de célula e texto inválido são pendências, nunca zero", () => {
    const parsed = parse({
      fileName: "x.xlsx",
      source: "xlsx",
      sheets: [{ name: "Pedido", hidden: false, rows: [[s("CÓDIGO"), s("ESCOLA"), s("Abacate"), s("Cheiro verde")], [s("1001"), s("ABELARDO"), { t: "error", v: "#REF!" }, s("muita")]] }],
    });
    const p = plan(parsed);
    expect(p.lines).toHaveLength(0);
    expect(p.pending.filter((x) => x.kind === "CELULA_INVALIDA")).toHaveLength(2);
  });

  it("pedido importado menor que a devolução já lançada bloqueia até excluir o item", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["1001", "ABELARDO", 3],
    ]);
    const key = lineKey("s-1001", "p-abacate");
    const ctx = { existingOrders: { [key]: 10 }, existingReturns: { [key]: 5 } };
    const bloqueado = plan(parsed, {}, ctx);
    expect(bloqueado.pending.find((x) => x.kind === "ABAIXO_DA_DEVOLUCAO")?.blocking).toBe(true);
    expect(bloqueado.canConfirm).toBe(false);
    const excluido = plan(parsed, { excludedLines: { [key]: true }, acknowledgeExclusions: true }, ctx);
    expect(excluido.pending.some((x) => x.kind === "ABAIXO_DA_DEVOLUCAO")).toBe(false);
  });

  it("reimportar os mesmos valores não soma nem regrava", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["1001", "ABELARDO", 8],
    ]);
    const p = plan(parsed, {}, { existingOrders: { [lineKey("s-1001", "p-abacate")]: 8 } });
    expect(line(p, "s-1001", "p-abacate")?.change).toBe("SEM_MUDANCA");
    expect(p.reconciliation.confirmedLines).toBe(0);
    expect(p.canConfirm).toBe(false);
  });

  it("assinatura do plano muda quando o valor atual muda (detecta alteração depois da prévia)", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["1001", "ABELARDO", 8],
    ]);
    const a = planSignature(plan(parsed, {}, { existingOrders: { [lineKey("s-1001", "p-abacate")]: 2 } }));
    const b = planSignature(plan(parsed, {}, { existingOrders: { [lineKey("s-1001", "p-abacate")]: 3 } }));
    expect(a).not.toBe(b);
  });

  it("sem cabeçalho reconhecível, a aba é marcada como não reconhecida (com motivo)", () => {
    const parsed = simpleWorkbook([["x", "y"], ["1", "2"]]);
    expect(parsed.sheets[0].kind).toBe("NAO_RECONHECIDA");
    expect(parsed.sheets[0].reason).toMatch(/CÓDIGO/);
  });

  it("código com '.0' do Excel ('4005.0') casa com o código do cadastro", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate"],
      ["1001.0", "ABELARDO", 1],
    ]);
    expect(parsed.sheets[0].rows[0].school).toEqual({ k: "OK", schoolId: "s-1001" });
  });

  it("cabeçalho repetido no meio da aba é ignorado", () => {
    const parsed = simpleWorkbook([
      ["CÓDIGO", "ESCOLA", "Abacate", "Cheiro verde"],
      ["1001", "ABELARDO", 1, 1],
      [null, null, "Abacate", "Cheiro verde"],
      ["1003", "BATAILLARD", 2, 2],
    ]);
    expect(parsed.sheets[0].ignoredRows).toEqual([{ row: 3, reason: "Cabeçalho repetido." }]);
    expect(parsed.sheets[0].rows).toHaveLength(2);
  });
});

describe("spec 009 — números em texto", () => {
  it.each([
    ["10", { k: "OK", v: 10 }],
    ["10,5", { k: "OK", v: 10.5 }],
    ["1.234,5", { k: "OK", v: 1234.5 }],
    ["2.5", { k: "OK", v: 2.5 }],
    ["0,125", { k: "PRECISAO", original: 0.125, rounded: 0.13 }],
    ["1,500", { k: "AMBIGUO", text: "1,500", options: [1.5, 1500] }],
    ["12.500", { k: "AMBIGUO", text: "12.500", options: [12.5, 12500] }],
    ["-3", { k: "INVALIDO", text: "-3", reason: "Quantidade negativa." }],
  ])("%s", (text, expected) => {
    expect(parseQtyText(text)).toEqual(expected);
  });
});

describe("spec 009 — volume: 191 escolas válidas", () => {
  it("reconhece as 191 escolas e todos os produtos ativos sem pendência", () => {
    const many = Array.from({ length: 191 }, (_, i) => ({ id: `s-${5000 + i}`, code: String(5000 + i), name: `ESCOLA MUNICIPAL TESTE ${i}` }));
    const offered = products.filter((p) => p.offered);
    const rows = [[s("CÓDIGO"), s("ESCOLA"), ...offered.map((p) => s(p.name))], ...many.map((sc, i) => [s(sc.code), s(sc.name), ...offered.map((_, j) => n(((i + j) % 9) + 1))])];
    const wb: RawWorkbook = { fileName: "191.xlsx", source: "xlsx", sheets: [{ name: "Pedido", hidden: false, rows }] };
    const started = performance.now();
    const parsed: ParsedWorkbook = { fileName: wb.fileName, source: wb.source, sheets: wb.sheets.map((sh) => parseSheet(sh, many, products)) };
    const p = buildImportPlan(parsed, { ...defaultDecisions(parsed), unitConfirmed: true }, { schools: many, products, existingOrders: {}, existingReturns: {} });
    const elapsed = performance.now() - started;
    expect(parsed.sheets[0].rows.every((r) => r.school.k === "OK")).toBe(true);
    expect(p.lines).toHaveLength(191 * offered.length);
    expect(p.pending).toHaveLength(0);
    expect(p.canConfirm).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("spec 009 — layout GZ com escola em uma única aba", () => {
  it("linha 1 Pedido/Entrega funciona mesmo com uma só coluna de produto", () => {
    const sheet = modalitySheet("Modalidade - UE", [schoolRow(n(1001), "ABELARDO DE LAMARE", n(8))]);
    const parsed = parse({ fileName: "a.xlsx", source: "xlsx", sheets: [sheet] });
    expect(line(plan(parsed), "s-1001", "p-abacate")?.newQty).toBe(8);
  });
});
