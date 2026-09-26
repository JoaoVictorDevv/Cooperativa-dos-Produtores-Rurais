import { describe, expect, it } from "vitest";
import {
  evaluateLedgerLine,
  executeCommand,
  ledgerClosingPreview,
  supplyIssues,
  type Actor,
  type CommandResult,
  type CycleCommand,
  type CycleLedger,
} from "./cycleLedger";

const ALFACE = "alface";
const COUVE = "couve";
const PRICE = 14.62;
const DED = 3.67;
const operador: Actor = { id: "u-operador", role: "OPERADOR" };

function ctx() {
  let n = 0;
  return { now: "2026-09-29T10:00:00-03:00", newId: () => `ev-${++n}` };
}

function ledger(partial: Partial<CycleLedger> = {}): CycleLedger {
  return {
    cycleId: "c1",
    status: "ABERTO",
    orders: [
      { schoolId: "E1", productId: ALFACE, orderedQty: 200, unit: "kg", price: PRICE },
      { schoolId: "E2", productId: COUVE, orderedQty: 30, unit: "kg", price: 8 },
    ],
    warehouseReceipts: [{ producerId: "A", productId: ALFACE, grossQty: 200, rejectedQty: 20, price: PRICE, logisticsDeductionSnapshot: DED }],
    events: [],
    decisions: [],
    audit: [],
    ...partial,
  };
}

// Aplica uma sequência de comandos; falha o teste se algum for recusado.
function run(start: CycleLedger, commands: CycleCommand[], actor = operador) {
  const c = ctx();
  let state = start;
  const results: CommandResult[] = [];
  for (const cmd of commands) {
    const r = executeCommand(state, cmd, actor, c);
    results.push(r);
    if (!r.ok) throw new Error(`${cmd.type} recusado: ${r.error}`);
    state = r.ledger;
  }
  return { state, results, ctx: c };
}

const inicial180: CycleCommand = {
  type: "REGISTRAR_ENTREGA_INICIAL",
  idempotencyKey: "k-inicial",
  schoolId: "E1",
  productId: ALFACE,
  presentedQty: 180,
  rejectedQty: 10,
  rejectionReason: "Folhas murchas",
  source: { type: "PRODUTOR", producerId: "A" },
  deliveredAt: "2026-09-28T09:40:00-03:00",
  receivedBy: "Merendeira Ana",
};
const complementoB30: CycleCommand = {
  type: "REGISTRAR_COMPLEMENTO",
  idempotencyKey: "k-comp-b",
  schoolId: "E1",
  productId: ALFACE,
  presentedQty: 30,
  rejectedQty: 0,
  source: { type: "PRODUTOR", producerId: "B" },
};

describe("etapa 4 — encerrar falta sem atendimento", () => {
  it("exemplo obrigatório: encerra em 170 com falta final 30, motivo e responsável; libera o fechamento", () => {
    const { state } = run(ledger({ orders: [ledger().orders[0]] }), [
      inicial180,
      { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "Sem alface no mercado", expectedShortageQty: 30, expectedVersion: null },
    ]);
    const line = evaluateLedgerLine(state, "E1", ALFACE);
    expect(line).toMatchObject({ acceptedQty: 170, shortageQty: 30, shortageStatus: "ENCERRADA_SEM_ATENDIMENTO", readyToClose: true });
    expect(state.decisions[0]).toMatchObject({ decidedBy: "u-operador", shortageQtyAtDecision: 30, reason: "Sem alface no mercado" });
    const preview = ledgerClosingPreview(state);
    expect(preview.canClose).toBe(true);
    expect(preview.receivableTotal).toBe(2485.4); // 170 × 14,62 — a falta não é cobrada
    expect(preview.payableTotal).toBe(1971); // 180 × 10,95 — o produtor não perde pela falta nem pela rejeição escolar
    expect(preview.closedShortages).toEqual([{ schoolId: "E1", productId: ALFACE, unit: "kg", qty: 30, reason: "Sem alface no mercado" }]);
    expect(state.audit.map((a) => a.action)).toEqual(["REGISTRAR_ENTREGA_INICIAL", "ENCERRAR_FALTA_SEM_ATENDIMENTO"]);
  });

  it("falta encerrada não vira pedido, cobrança nem pendência no ciclo seguinte", () => {
    const { state } = run(ledger({ orders: [ledger().orders[0]] }), [
      inicial180,
      { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "Sem produto", expectedShortageQty: 30, expectedVersion: null },
    ]);
    // O ciclo seguinte começa só com os pedidos novos da prefeitura.
    const next = ledger({ cycleId: "c2", orders: [{ schoolId: "E1", productId: ALFACE, orderedQty: 100, unit: "kg", price: PRICE }], warehouseReceipts: [] });
    expect(next.decisions).toHaveLength(0);
    expect(evaluateLedgerLine(next, "E1", ALFACE).orderedQty).toBe(100);
    expect(state.decisions).toHaveLength(1); // continua no histórico do ciclo 1
  });

  it("só encerra depois de conferir: entrega não informada não é zero", () => {
    const r = run(ledger(), [{ ...inicial180, presentedQty: null, rejectedQty: 0, rejectionReason: null }]);
    const refused = executeCommand(r.state, { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "x y z", expectedShortageQty: 200, expectedVersion: null }, operador, r.ctx);
    expect(refused).toMatchObject({ ok: false, code: "INVALIDO" });
  });

  it("exige motivo e confere a falta mostrada na tela (outra pessoa pode ter mudado)", () => {
    const { state, ctx: c } = run(ledger(), [inicial180]);
    const base = { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO" as const, schoolId: "E1", productId: ALFACE, expectedVersion: null };
    expect(executeCommand(state, { ...base, reason: " ", expectedShortageQty: 30 }, operador, c)).toMatchObject({ ok: false, code: "INVALIDO" });
    expect(executeCommand(state, { ...base, reason: "Sem produto", expectedShortageQty: 40 }, operador, c)).toMatchObject({ ok: false, code: "CONFLITO" });
  });

  it("não há atalho 'resolvida': em resolução continua bloqueando o fechamento", () => {
    const { state } = run(ledger({ orders: [ledger().orders[0]] }), [
      inicial180,
      { type: "MARCAR_FALTA_EM_RESOLUCAO", schoolId: "E1", productId: ALFACE, reason: "Buscando com o produtor B", expectedVersion: null },
    ]);
    expect(evaluateLedgerLine(state, "E1", ALFACE).shortageStatus).toBe("EM_RESOLUCAO");
    expect(ledgerClosingPreview(state).canClose).toBe(false);
  });

  it("duas pessoas decidindo a mesma falta: a segunda é recusada", () => {
    const { state, ctx: c } = run(ledger(), [inicial180, { type: "MARCAR_FALTA_EM_RESOLUCAO", schoolId: "E1", productId: ALFACE, expectedVersion: null }]);
    // As duas abriram a tela com a versão 1.
    const first = executeCommand(state, { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "Sem produto", expectedShortageQty: 30, expectedVersion: 1 }, operador, c);
    expect(first.ok).toBe(true);
    const second = executeCommand(first.ok ? first.ledger : state, { type: "REVOGAR_DECISAO_FALTA", schoolId: "E1", productId: ALFACE, reason: "Achei produto", expectedVersion: 1 }, operador, c);
    expect(second).toMatchObject({ ok: false, code: "CONFLITO" });
  });
});

describe("etapa 4 — complementos", () => {
  it("complemento de 30 de outro produtor: escola 200, sem falta; entrega inicial e perda de 10 preservadas", () => {
    const { state, results } = run(ledger(), [inicial180, complementoB30]);
    const line = evaluateLedgerLine(state, "E1", ALFACE);
    expect(line).toMatchObject({ acceptedQty: 200, shortageQty: 0, rejectedAtSchoolQty: 10, attendance: "OK" });
    expect(state.events.find((e) => e.kind === "INICIAL")).toMatchObject({ presentedQty: 180, rejectedQty: 10, deliveredAt: "2026-09-28T09:40:00-03:00", version: 1 });
    // B ainda não tem recebimento no galpão: aviso ao registrar e bloqueio no fechamento.
    const last = results[1];
    expect(last.ok && last.warnings.join(" ")).toMatch(/recebimento conferido no galpão/);
    expect(ledgerClosingPreview(state).blockers).toContain("1 complemento(s) sem recebimento conferido no galpão do produtor de origem.");
  });

  it("com o recebimento de B no galpão: cada produtor recebe pelo seu aceito; a escola é cobrada 200 uma vez", () => {
    const withB = ledger({
      warehouseReceipts: [
        ...ledger().warehouseReceipts,
        { producerId: "B", productId: ALFACE, grossQty: 30, rejectedQty: 0, price: PRICE, logisticsDeductionSnapshot: DED },
        { producerId: "C", productId: COUVE, grossQty: 30, rejectedQty: 0, price: 8, logisticsDeductionSnapshot: 2 },
      ],
    });
    const { state } = run(withB, [
      inicial180,
      complementoB30,
      { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "k-couve", schoolId: "E2", productId: COUVE, presentedQty: 30, rejectedQty: 0 },
    ]);
    const p = ledgerClosingPreview(state);
    expect(p.canClose).toBe(true);
    expect(p.receivableLines.find((l) => l.productId === ALFACE)?.value).toBe(2924); // 200 × 14,62
    expect(p.payableLines.filter((l) => l.productId === ALFACE).map((l) => [l.producerId, l.acceptedQty])).toEqual([
      ["A", 180],
      ["B", 30],
    ]);
  });

  it("duplo clique ou reenvio não duplica; mesmo envio com outros valores é recusado", () => {
    const { state, ctx: c } = run(ledger(), [inicial180, complementoB30]);
    const again = executeCommand(state, complementoB30, operador, c);
    expect(again).toMatchObject({ ok: true, effect: "JA_REGISTRADO" });
    expect(again.ok && again.ledger.events).toHaveLength(2);
    const different = executeCommand(state, { ...complementoB30, presentedQty: 25 }, operador, c);
    expect(different).toMatchObject({ ok: false, code: "CONFLITO" });
  });

  it("segunda entrega inicial é recusada: correção não é nova entrega", () => {
    const { state, ctx: c } = run(ledger(), [inicial180]);
    const r = executeCommand(state, { ...inicial180, idempotencyKey: "outra" }, operador, c);
    expect(r).toMatchObject({ ok: false, code: "CONFLITO" });
    expect(!r.ok && r.error).toMatch(/corrija o lançamento/);
  });

  it("complemento precisa de origem explícita, quantidade e pedido original", () => {
    const { state, ctx: c } = run(ledger(), [inicial180]);
    const noSource = { ...complementoB30, idempotencyKey: "a", source: undefined } as unknown as CycleCommand;
    expect(executeCommand(state, noSource, operador, c)).toMatchObject({ ok: false, code: "INVALIDO" });
    expect(executeCommand(state, { ...complementoB30, idempotencyKey: "b", presentedQty: 0 }, operador, c)).toMatchObject({ ok: false, code: "INVALIDO" });
    expect(executeCommand(state, { ...complementoB30, idempotencyKey: "c", schoolId: "E9" }, operador, c)).toMatchObject({ ok: false, code: "INVALIDO" });
  });

  it("complemento do saldo do galpão é aceito sem produtor (o produto já foi recebido e pago a quem entregou)", () => {
    const { state } = run(ledger(), [
      { ...inicial180, rejectedQty: 0, rejectionReason: null, presentedQty: 170 },
      { ...complementoB30, presentedQty: 10, source: { type: "SALDO_GALPAO" } },
    ]);
    expect(evaluateLedgerLine(state, "E1", ALFACE).acceptedQty).toBe(180);
    expect(supplyIssues(state)).toEqual([]);
  });

  it("complemento maior que a falta gera excedente visível, sem cortar o registro", () => {
    const { state, results } = run(ledger(), [inicial180, { ...complementoB30, presentedQty: 40 }]);
    expect(evaluateLedgerLine(state, "E1", ALFACE)).toMatchObject({ acceptedQty: 210, excessQty: 10, attendance: "EXCEDENTE" });
    expect(results[1].ok && results[1].warnings[0]).toMatch(/excedente de 10 kg/);
  });

  it("pedido 30 + complemento 20 com inicial vazio: pendente; confirmando zero inicial, falta 10 e pode encerrar", () => {
    const start = ledger({ warehouseReceipts: [{ producerId: "C", productId: COUVE, grossQty: 20, rejectedQty: 0 }] });
    const comp: CycleCommand = { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "k-c", schoolId: "E2", productId: COUVE, presentedQty: 20, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "C" } };
    const { state, results, ctx: c } = run(start, [comp]);
    expect(evaluateLedgerLine(state, "E2", COUVE).receiptStatus).toBe("PENDENTE_CONFERENCIA");
    expect(results[0].ok && results[0].warnings.join(" ")).toMatch(/registre zero confirmado/);
    const zero = executeCommand(state, { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "k-zero", schoolId: "E2", productId: COUVE, presentedQty: 0, rejectedQty: 0 }, operador, c);
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(evaluateLedgerLine(zero.ledger, "E2", COUVE)).toMatchObject({ receiptStatus: "CONFERIDO", acceptedQty: 20, shortageQty: 10, shortageStatus: "SEM_DECISAO" });
    const closed = executeCommand(zero.ledger, { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E2", productId: COUVE, reason: "Produtor sem couve", expectedShortageQty: 10, expectedVersion: null }, operador, c);
    expect(closed.ok).toBe(true);
  });

  it("perda antes da escola é separada da rejeição escolar e exige motivo", () => {
    const { state, ctx: c } = run(ledger(), [{ ...inicial180, lossBeforeSchoolQty: 5, lossReason: "Caixa caiu no transporte" }]);
    expect(evaluateLedgerLine(state, "E1", ALFACE)).toMatchObject({ rejectedAtSchoolQty: 10, lossBeforeSchoolQty: 5, acceptedQty: 170 });
    const semMotivo = executeCommand(ledger(), { ...inicial180, lossBeforeSchoolQty: 5 }, operador, c);
    expect(semMotivo).toMatchObject({ ok: false, code: "INVALIDO" });
  });
});

describe("etapa 4 — correções auditadas e decisões que ficam incoerentes", () => {
  it("correção guarda antes/depois só do que mudou, com motivo, e sobe a versão", () => {
    const { state, ctx: c } = run(ledger(), [inicial180]);
    const id = state.events[0].id;
    const r = executeCommand(state, { type: "CORRIGIR_EVENTO", eventId: id, expectedVersion: 1, changes: { presentedQty: 185 }, reason: "Erro de digitação" }, operador, c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ledger.events[0]).toMatchObject({ presentedQty: 185, version: 2 });
    expect(r.audit[0]).toMatchObject({ action: "CORRIGIR_EVENTO", before: { presentedQty: 180 }, after: { presentedQty: 185 }, reason: "Erro de digitação" });
    expect(r.ledger.events).toHaveLength(1); // não virou nova entrega
  });

  it("correção com versão antiga (outra pessoa corrigiu antes) é recusada", () => {
    const { state, ctx: c } = run(ledger(), [inicial180]);
    const id = state.events[0].id;
    const first = executeCommand(state, { type: "CORRIGIR_EVENTO", eventId: id, expectedVersion: 1, changes: { presentedQty: 185 }, reason: "a" }, operador, c);
    if (!first.ok) throw new Error(first.error);
    const second = executeCommand(first.ledger, { type: "CORRIGIR_EVENTO", eventId: id, expectedVersion: 1, changes: { presentedQty: 175 }, reason: "b" }, operador, c);
    expect(second).toMatchObject({ ok: false, code: "CONFLITO" });
  });

  it("não reduz a entrega abaixo da rejeição já registrada; corrigir rejeição para zero funciona", () => {
    const { state, ctx: c } = run(ledger(), [inicial180]);
    const id = state.events[0].id;
    const below = executeCommand(state, { type: "CORRIGIR_EVENTO", eventId: id, expectedVersion: 1, changes: { presentedQty: 5 }, reason: "x" }, operador, c);
    expect(below).toMatchObject({ ok: false, code: "INVALIDO" });
    expect(!below.ok && below.error).toMatch(/Corrija a rejeição primeiro/);
    const toZero = executeCommand(state, { type: "CORRIGIR_EVENTO", eventId: id, expectedVersion: 1, changes: { rejectedQty: 0 }, reason: "Rejeição lançada por engano" }, operador, c);
    expect(toZero.ok && evaluateLedgerLine(toZero.ledger, "E1", ALFACE).acceptedQty).toBe(180);
  });

  it("mudança posterior na falta torna o encerramento incoerente, avisa e bloqueia até revisar", () => {
    const { state, ctx: c } = run(ledger({ orders: [ledger().orders[0]] }), [
      inicial180,
      { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "Sem produto", expectedShortageQty: 30, expectedVersion: null },
    ]);
    const id = state.events[0].id;
    const corr = executeCommand(state, { type: "CORRIGIR_EVENTO", eventId: id, expectedVersion: 1, changes: { rejectedQty: 20 }, reason: "Recontagem" }, operador, c);
    if (!corr.ok) throw new Error(corr.error);
    expect(corr.warnings[0]).toMatch(/ficou incoerente: a falta agora é 40/);
    expect(ledgerClosingPreview(corr.ledger).canClose).toBe(false);
    const revoked = executeCommand(corr.ledger, { type: "REVOGAR_DECISAO_FALTA", schoolId: "E1", productId: ALFACE, reason: "Falta mudou", expectedVersion: 1 }, operador, c);
    if (!revoked.ok) throw new Error(revoked.error);
    const reclosed = executeCommand(revoked.ledger, { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "Sem produto", expectedShortageQty: 40, expectedVersion: null }, operador, c);
    expect(reclosed.ok && ledgerClosingPreview(reclosed.ledger).canClose).toBe(true);
    expect(reclosed.ok && reclosed.ledger.audit.map((a) => a.action)).toContain("REVOGAR_DECISAO_FALTA");
  });

  it("complemento que cobre uma falta já encerrada avisa que a decisão deixou de existir", () => {
    const { results } = run(ledger(), [
      inicial180,
      { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO", schoolId: "E1", productId: ALFACE, reason: "Sem produto", expectedShortageQty: 30, expectedVersion: null },
      complementoB30,
    ]);
    const r = results[2];
    expect(r.ok && r.warnings.join(" ")).toMatch(/deixou de existir/);
  });
});

describe("etapa 4 — limites", () => {
  it("perfil de consulta e ciclo fechado não alteram nada", () => {
    const c = ctx();
    expect(executeCommand(ledger(), inicial180, { id: "u", role: "CONSULTA" }, c)).toMatchObject({ ok: false, code: "SEM_PERMISSAO" });
    expect(executeCommand(ledger({ status: "FECHADO" }), inicial180, operador, c)).toMatchObject({ ok: false, code: "CICLO_FECHADO" });
  });

  it("recusa mais de 2 casas decimais, negativos e rejeição sem motivo", () => {
    const c = ctx();
    expect(executeCommand(ledger(), { ...inicial180, presentedQty: 180.005 }, operador, c)).toMatchObject({ ok: false });
    expect(executeCommand(ledger(), { ...inicial180, presentedQty: -1 }, operador, c)).toMatchObject({ ok: false });
    expect(executeCommand(ledger(), { ...inicial180, rejectionReason: "" }, operador, c)).toMatchObject({ ok: false });
  });

  it("escolas com mais do que o galpão aceitou: aviso de saldo a conferir, sem inventar estoque", () => {
    const { state } = run(ledger({ warehouseReceipts: [{ producerId: "A", productId: ALFACE, grossQty: 150, rejectedQty: 0 }] }), [inicial180]);
    const issues = supplyIssues(state);
    expect(issues).toEqual([expect.objectContaining({ severity: "AVISO", productId: ALFACE })]);
    expect(issues[0].message).toMatch(/30 a mais/);
    expect(ledgerClosingPreview(state).warnings).toHaveLength(1);
  });
});
