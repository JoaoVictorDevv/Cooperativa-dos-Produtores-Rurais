// Pacote de aceitação (spec 008 + galpão + arredondamento) para a API Java
// reproduzir antes de qualquer tela passar a usá-la. As expectativas são
// escritas à mão a partir da spec e do prompt v2 §17 — não são "o que o código
// faz hoje". O teste acceptanceCases.test.ts roda cada caso contra a
// implementação de referência (TypeScript) e garante que
// docs/aceitacao/casos.json é exatamente a exportação destes casos.

import { round2, treasuryTotal, treasuryTotalPerLine } from "../calc";
import { producerPayable, schoolReceivable, summarizeCycle, type CycleState, type QtyTotals, type SchoolLineResult, type Unit } from "../domain/cycle";
import {
  cycleInput,
  evaluateLedgerLine,
  executeCommand,
  ledgerClosingPreview,
  type Actor,
  type CommandErrorCode,
  type CycleCommand,
  type CycleLedger,
} from "../domain/cycleLedger";

export interface AcceptanceStep {
  command: CycleCommand;
  actor?: Actor;
  expect: { ok: boolean; code?: CommandErrorCode; effect?: "APLICADO" | "JA_REGISTRADO"; warningsContain?: string[] };
}

export interface AcceptanceCase {
  id: string;
  titulo: string;
  origem: string;
  inicial: CycleLedger;
  passos: AcceptanceStep[];
  linhas?: { schoolId: string; productId: string; expect: Partial<Pick<SchoolLineResult, "receiptStatus" | "acceptedQty" | "presentedQty" | "rejectedAtSchoolQty" | "lossBeforeSchoolQty" | "shortageQty" | "excessQty" | "shortageStatus" | "attendance" | "readyToClose">> }[];
  fechamento?: {
    state?: CycleState;
    canClose?: boolean;
    receivableTotal?: number;
    payableTotal?: number;
    calculatedResult?: number;
    blockersContain?: string[];
    payableLines?: { producerId: string; productId: string; acceptedQty: number; value: number }[];
    closedShortages?: { schoolId: string; productId: string; qty: number }[];
  };
  totaisPorUnidade?: Partial<Record<Unit, Partial<QtyTotals>>>;
  atendimentoPorUnidade?: Partial<Record<Unit, number | null>>;
}

export interface CalculationCase {
  id: string;
  titulo: string;
  funcao: "producerPayable" | "schoolReceivable" | "treasuryTotalPerLine" | "treasuryTotal";
  entrada: unknown;
  esperado: number;
}

const operador: Actor = { id: "u-operador", role: "OPERADOR" };
const PRICE = 14.62; // alface
const DED = 3.67; // desconto de logística → preço líquido 10,95

function base(partial: Partial<CycleLedger> = {}): CycleLedger {
  return {
    cycleId: "ciclo-1",
    status: "ABERTO",
    orders: [{ schoolId: "E1", productId: "alface", orderedQty: 200, unit: "kg", price: PRICE }],
    warehouseReceipts: [{ producerId: "A", productId: "alface", grossQty: 200, rejectedQty: 20, unit: "kg", price: PRICE, logisticsDeductionSnapshot: DED }],
    events: [],
    decisions: [],
    audit: [],
    ...partial,
  };
}

const inicial180: CycleCommand = {
  type: "REGISTRAR_ENTREGA_INICIAL",
  idempotencyKey: "k-inicial",
  schoolId: "E1",
  productId: "alface",
  presentedQty: 180,
  rejectedQty: 10,
  rejectionReason: "Folhas murchas",
  source: { type: "PRODUTOR", producerId: "A" },
  deliveredAt: "2026-09-28T09:40",
  receivedBy: "Merendeira",
};
const encerrar = (qty: number, schoolId = "E1", productId = "alface"): CycleCommand => ({
  type: "ENCERRAR_FALTA_SEM_ATENDIMENTO",
  schoolId,
  productId,
  reason: "Sem produto no mercado",
  expectedShortageQty: qty,
  expectedVersion: null,
});
const ok = { ok: true, effect: "APLICADO" as const };

export const ACCEPTANCE_CASES: AcceptanceCase[] = [
  {
    id: "exemplo-200-180-170",
    titulo: "Exemplo obrigatório: pedido 200, galpão 200 − 20, escola 180 − 10",
    origem: "prompt v2 §4 e §17; spec 008 CA-008.1",
    inicial: base(),
    passos: [{ command: inicial180, expect: ok }],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { acceptedQty: 170, rejectedAtSchoolQty: 10, shortageQty: 30, shortageStatus: "SEM_DECISAO", readyToClose: false } }],
    fechamento: { state: "AGUARDANDO_DECISOES", canClose: false, receivableTotal: 2485.4, payableTotal: 1971, blockersContain: ["1 falta(s) sem decisão."] },
    totaisPorUnidade: { kg: { acceptedAtWarehouseQty: 180, rejectedAtWarehouseQty: 20, acceptedAtSchoolQty: 170, rejectedAtSchoolQty: 10, shortageQty: 30 } },
  },
  {
    id: "encerrar-sem-reposicao",
    titulo: "Sem reposição: encerrar em 170 com falta final 30 e motivo; fechamento liberado; não é cobrada",
    origem: "prompt v2 §8 e §17; spec 008 CA-008.3",
    inicial: base(),
    passos: [{ command: inicial180, expect: ok }, { command: encerrar(30), expect: ok }],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { acceptedQty: 170, shortageQty: 30, shortageStatus: "ENCERRADA_SEM_ATENDIMENTO", readyToClose: true } }],
    fechamento: { state: "PRONTO_PARA_FECHAR", canClose: true, receivableTotal: 2485.4, payableTotal: 1971, calculatedResult: 514.4, closedShortages: [{ schoolId: "E1", productId: "alface", qty: 30 }] },
  },
  {
    id: "complemento-outro-produtor",
    titulo: "Complemento de 30 aceitos de outro produtor: escola 200; produtor original 180; novo 30; perda de 10 mantida; cobra 200 uma vez",
    origem: "prompt v2 §7 e §17; spec 008 CA-008.2",
    inicial: base({
      warehouseReceipts: [
        { producerId: "A", productId: "alface", grossQty: 200, rejectedQty: 20, unit: "kg", price: PRICE, logisticsDeductionSnapshot: DED },
        { producerId: "B", productId: "alface", grossQty: 30, rejectedQty: 0, unit: "kg", price: PRICE, logisticsDeductionSnapshot: DED },
      ],
    }),
    passos: [
      { command: inicial180, expect: ok },
      { command: { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "k-comp", schoolId: "E1", productId: "alface", presentedQty: 30, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "B" } }, expect: ok },
    ],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { acceptedQty: 200, rejectedAtSchoolQty: 10, shortageQty: 0, attendance: "OK", readyToClose: true } }],
    fechamento: {
      canClose: true,
      receivableTotal: 2924,
      payableLines: [
        { producerId: "A", productId: "alface", acceptedQty: 180, value: 1971 },
        { producerId: "B", productId: "alface", acceptedQty: 30, value: 328.5 },
      ],
    },
  },
  {
    id: "complemento-sem-recebimento-galpao",
    titulo: "Complemento de produtor sem recebimento conferido no galpão: aviso ao registrar e bloqueio no fechamento",
    origem: "prompt v2 §7 (fornecimento de origem no controle do galpão); spec 008 CA-008.20",
    inicial: base(),
    passos: [
      { command: inicial180, expect: ok },
      {
        command: { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "k-comp", schoolId: "E1", productId: "alface", presentedQty: 30, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "C" } },
        expect: { ok: true, effect: "APLICADO", warningsContain: ["recebimento conferido no galpão"] },
      },
    ],
    fechamento: { canClose: false, blockersContain: ["1 complemento(s) sem recebimento conferido no galpão do produtor de origem."] },
  },
  {
    id: "complemento-inicial-vazio",
    titulo: "Pedido 30, complemento de 20 aceito e inicial vazio: pendente; confirmando zero inicial, falta 10",
    origem: "prompt v2 §8 e §17; spec 008 CA-008.4",
    inicial: base({
      orders: [{ schoolId: "E2", productId: "couve", orderedQty: 30, unit: "kg", price: 14.6 }],
      warehouseReceipts: [{ producerId: "C", productId: "couve", grossQty: 20, rejectedQty: 0, unit: "kg", price: 14.6, logisticsDeductionSnapshot: DED }],
    }),
    passos: [
      {
        command: { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "k-c", schoolId: "E2", productId: "couve", presentedQty: 20, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "C" } },
        expect: { ok: true, effect: "APLICADO", warningsContain: ["registre zero confirmado"] },
      },
      { command: encerrar(10, "E2", "couve"), expect: { ok: false, code: "INVALIDO" } },
      { command: { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "k-zero", schoolId: "E2", productId: "couve", presentedQty: 0, rejectedQty: 0 }, expect: ok },
    ],
    linhas: [{ schoolId: "E2", productId: "couve", expect: { receiptStatus: "CONFERIDO", acceptedQty: 20, shortageQty: 10, shortageStatus: "SEM_DECISAO" } }],
  },
  {
    id: "vazio-zero-pedido-zero",
    titulo: "Vazio fica pendente; zero confirmado é conferência (falta integral); pedido zero sem movimento não bloqueia",
    origem: "prompt v2 §6, §8 e §17; spec 008 CA-008.4",
    inicial: base({
      orders: [
        { schoolId: "E1", productId: "alface", orderedQty: 50, unit: "kg", price: PRICE },
        { schoolId: "E2", productId: "alface", orderedQty: 40, unit: "kg", price: PRICE },
        { schoolId: "E3", productId: "alface", orderedQty: 0, unit: "kg", price: PRICE },
      ],
    }),
    passos: [{ command: { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "k-z", schoolId: "E2", productId: "alface", presentedQty: 0, rejectedQty: 0 }, expect: ok }],
    linhas: [
      { schoolId: "E1", productId: "alface", expect: { receiptStatus: "PENDENTE_CONFERENCIA", acceptedQty: 0 } },
      { schoolId: "E2", productId: "alface", expect: { receiptStatus: "CONFERIDO", acceptedQty: 0, shortageQty: 40, shortageStatus: "SEM_DECISAO" } },
      { schoolId: "E3", productId: "alface", expect: { receiptStatus: "SEM_PEDIDO", readyToClose: true } },
    ],
    fechamento: { state: "EM_CONFERENCIA", canClose: false },
    // Falta total só com linhas conferidas: 40 (E2); E1 está a conferir.
    totaisPorUnidade: { kg: { shortageQty: 40, pendingLines: 1 } },
  },
  {
    id: "ciclo-vazio",
    titulo: "Ciclo sem pedido e sem movimento: aguardando pedido, nunca 'tudo conferido'",
    origem: "prompt v2 §8; spec 008 CA-008.5",
    inicial: base({ orders: [], warehouseReceipts: [] }),
    passos: [],
    fechamento: { state: "AGUARDANDO_PEDIDO", canClose: false, blockersContain: ["Ciclo sem pedido e sem movimentação."] },
  },
  {
    id: "correcao-rejeicao-e-limites",
    titulo: "Rejeição corrigida para zero funciona; reduzir a entrega abaixo da rejeição é recusado; versão antiga é recusada",
    origem: "prompt v2 §9 e §16; spec 008 CA-008.6, CA-008.17",
    inicial: base(),
    passos: [
      { command: inicial180, expect: ok },
      { command: { type: "CORRIGIR_EVENTO", eventId: "ev-1", expectedVersion: 1, changes: { presentedQty: 5 }, reason: "teste" }, expect: { ok: false, code: "INVALIDO" } },
      { command: { type: "CORRIGIR_EVENTO", eventId: "ev-1", expectedVersion: 1, changes: { rejectedQty: 0 }, reason: "Rejeição lançada por engano" }, expect: ok },
      { command: { type: "CORRIGIR_EVENTO", eventId: "ev-1", expectedVersion: 1, changes: { presentedQty: 170 }, reason: "versão antiga" }, expect: { ok: false, code: "CONFLITO" } },
    ],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { acceptedQty: 180, rejectedAtSchoolQty: 0, shortageQty: 20 } }],
  },
  {
    id: "decisao-incoerente",
    titulo: "Correção posterior muda a falta: a decisão de encerramento fica incoerente e bloqueia até ser revista",
    origem: "prompt v2 §8; spec 008 RN-11, CA-008.19",
    inicial: base(),
    passos: [
      { command: inicial180, expect: ok },
      { command: encerrar(30), expect: ok },
      { command: { type: "CORRIGIR_EVENTO", eventId: "ev-1", expectedVersion: 1, changes: { rejectedQty: 20 }, reason: "Recontagem" }, expect: { ok: true, effect: "APLICADO", warningsContain: ["ficou incoerente"] } },
    ],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { shortageQty: 40, shortageStatus: "DECISAO_INCOERENTE", readyToClose: false } }],
    fechamento: { state: "AGUARDANDO_DECISOES", canClose: false },
  },
  {
    id: "reenvio-e-segunda-inicial",
    titulo: "Reenvio (mesma chave, mesmos dados) não duplica; mesma chave com outros dados é conflito; segunda entrega inicial é recusada",
    origem: "prompt v2 §7 (sem duplicação); spec 008 CA-008.16, CA-008.17",
    inicial: base(),
    passos: [
      { command: inicial180, expect: ok },
      { command: inicial180, expect: { ok: true, effect: "JA_REGISTRADO" } },
      { command: { ...inicial180, presentedQty: 170 } as CycleCommand, expect: { ok: false, code: "CONFLITO" } },
      { command: { ...inicial180, idempotencyKey: "outra" } as CycleCommand, expect: { ok: false, code: "CONFLITO" } },
    ],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { presentedQty: 180, acceptedQty: 170 } }],
  },
  {
    id: "perda-antes-da-escola",
    titulo: "Perda de transporte separada da rejeição escolar; não reduz o produtor; exige motivo",
    origem: "prompt v2 §6 e §17; spec 008 RN-07, CA-008.7",
    inicial: base(),
    passos: [
      { command: { ...inicial180, lossBeforeSchoolQty: 5 } as CycleCommand, expect: { ok: false, code: "INVALIDO" } },
      { command: { ...inicial180, idempotencyKey: "k2", lossBeforeSchoolQty: 5, lossReason: "Caixa caiu no transporte" } as CycleCommand, expect: ok },
    ],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { rejectedAtSchoolQty: 10, lossBeforeSchoolQty: 5, acceptedQty: 170 } }],
    fechamento: { payableTotal: 1971 },
  },
  {
    id: "excesso-nao-compensa-falta",
    titulo: "Excedente numa escola não compensa falta de outra; atendimento limita cada linha ao próprio pedido",
    origem: "prompt v2 §7 e §10; spec 008 CA-008.8",
    inicial: base({
      orders: [
        { schoolId: "E1", productId: "alface", orderedQty: 100, unit: "kg", price: PRICE },
        { schoolId: "E2", productId: "alface", orderedQty: 100, unit: "kg", price: PRICE },
      ],
    }),
    passos: [
      { command: { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "a", schoolId: "E1", productId: "alface", presentedQty: 120, rejectedQty: 0 }, expect: ok },
      { command: { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "b", schoolId: "E2", productId: "alface", presentedQty: 80, rejectedQty: 0 }, expect: ok },
    ],
    linhas: [
      { schoolId: "E1", productId: "alface", expect: { excessQty: 20, shortageQty: 0, attendance: "EXCEDENTE" } },
      { schoolId: "E2", productId: "alface", expect: { excessQty: 0, shortageQty: 20, attendance: "FALTA" } },
    ],
    totaisPorUnidade: { kg: { excessQty: 20, shortageQty: 20 } },
    atendimentoPorUnidade: { kg: 90 },
  },
  {
    id: "unidades-separadas",
    titulo: "kg e dz nunca se somam; atendimento por unidade",
    origem: "prompt v2 §10; spec 008 RN-14, CA-008.12",
    inicial: base({
      orders: [
        { schoolId: "E1", productId: "alface", orderedQty: 10, unit: "kg", price: PRICE },
        { schoolId: "E1", productId: "ovos", orderedQty: 12, unit: "dz", price: 15.45 },
      ],
      warehouseReceipts: [],
    }),
    passos: [
      { command: { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "a", schoolId: "E1", productId: "alface", presentedQty: 10, rejectedQty: 0 }, expect: ok },
      { command: { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "b", schoolId: "E1", productId: "ovos", presentedQty: 10, rejectedQty: 0 }, expect: ok },
    ],
    totaisPorUnidade: { kg: { orderedQty: 10, acceptedAtSchoolQty: 10 }, dz: { orderedQty: 12, acceptedAtSchoolQty: 10, shortageQty: 2 } },
    atendimentoPorUnidade: { kg: 100, dz: 83.33 },
  },
  {
    id: "perfil-consulta",
    titulo: "Perfil de consulta não altera nada",
    origem: "prompt v2 §16; spec 008 RN-19",
    inicial: base(),
    passos: [{ command: inicial180, actor: { id: "u-consulta", role: "CONSULTA" }, expect: { ok: false, code: "SEM_PERMISSAO" } }],
    linhas: [{ schoolId: "E1", productId: "alface", expect: { receiptStatus: "PENDENTE_CONFERENCIA" } }],
  },
  {
    id: "ciclo-fechado",
    titulo: "Ciclo fechado não aceita comando (vale antes da checagem de perfil)",
    origem: "prompt v2 §8 e §16",
    inicial: base({ status: "FECHADO" }),
    passos: [
      { command: inicial180, expect: { ok: false, code: "CICLO_FECHADO" } },
      { command: inicial180, actor: { id: "u-consulta", role: "CONSULTA" }, expect: { ok: false, code: "CICLO_FECHADO" } },
    ],
  },
];

export const CALCULATION_CASES: CalculationCase[] = [
  { id: "pagar-180", titulo: "A pagar = aceito no galpão × (preço − desconto)", funcao: "producerPayable", entrada: { acceptedQty: 180, price: 14.62, logisticsDeductionSnapshot: 3.67 }, esperado: 1971 },
  { id: "pagar-decimal", titulo: "Aceito com decimais", funcao: "producerPayable", entrada: { acceptedQty: 33, price: 14.6, logisticsDeductionSnapshot: 3.67 }, esperado: 360.69 },
  { id: "cobrar-170", titulo: "A cobrar = aceito na escola × preço congelado", funcao: "schoolReceivable", entrada: { acceptedQty: 170, price: 14.62 }, esperado: 2485.4 },
  {
    id: "arredondamento-por-linha",
    titulo: "Ciclos novos (desde 27/09/2026): total = soma das linhas já arredondadas",
    funcao: "treasuryTotalPerLine",
    entrada: { lines: Array.from({ length: 3 }, () => ({ orderedQty: 0.33, returnedQty: 0, price: 10.05 })) },
    esperado: 9.96,
  },
  {
    id: "arredondamento-legado",
    titulo: "Ciclos anteriores: total arredondado só no fim (não recalcular o passado)",
    funcao: "treasuryTotal",
    entrada: { lines: Array.from({ length: 3 }, () => ({ orderedQty: 0.33, returnedQty: 0, price: 10.05 })) },
    esperado: 9.95,
  },
];

// ---------------------------------------------------------------- executor de referência

export function runAcceptanceCase(c: AcceptanceCase): string[] {
  const failures: string[] = [];
  let n = 0;
  const ctx = { now: "2026-09-29T10:00:00-03:00", newId: () => `ev-${++n}` };
  let ledger = c.inicial;
  c.passos.forEach((step, i) => {
    const r = executeCommand(ledger, step.command, step.actor ?? operador, ctx);
    const where = `passo ${i + 1} (${step.command.type})`;
    if (r.ok !== step.expect.ok) failures.push(`${where}: ok=${r.ok}${r.ok ? "" : ` (${r.code}: ${r.error})`}, esperado ${step.expect.ok}`);
    if (!r.ok && step.expect.code && r.code !== step.expect.code) failures.push(`${where}: código ${r.code}, esperado ${step.expect.code}`);
    if (r.ok) {
      if (step.expect.effect && r.effect !== step.expect.effect) failures.push(`${where}: efeito ${r.effect}, esperado ${step.expect.effect}`);
      for (const w of step.expect.warningsContain ?? []) if (!r.warnings.some((x) => x.includes(w))) failures.push(`${where}: aviso contendo "${w}" não emitido`);
      ledger = r.ledger;
    }
  });
  for (const l of c.linhas ?? []) {
    const got = evaluateLedgerLine(ledger, l.schoolId, l.productId);
    for (const [k, v] of Object.entries(l.expect)) {
      if (got[k as keyof SchoolLineResult] !== v) failures.push(`linha ${l.schoolId}/${l.productId}: ${k}=${String(got[k as keyof SchoolLineResult])}, esperado ${String(v)}`);
    }
  }
  const preview = ledgerClosingPreview(ledger);
  const summary = summarizeCycle(cycleInput(ledger));
  const f = c.fechamento;
  if (f) {
    const cmp = (label: string, got: unknown, exp: unknown) => exp !== undefined && got !== exp && failures.push(`fechamento ${label}=${String(got)}, esperado ${String(exp)}`);
    cmp("state", summary.state, f.state);
    cmp("canClose", preview.canClose, f.canClose);
    cmp("receivableTotal", preview.receivableTotal, f.receivableTotal);
    cmp("payableTotal", preview.payableTotal, f.payableTotal);
    cmp("calculatedResult", preview.calculatedResult, f.calculatedResult);
    for (const b of f.blockersContain ?? []) if (!preview.blockers.includes(b)) failures.push(`fechamento: bloqueio "${b}" ausente (${preview.blockers.join(" | ")})`);
    if (f.payableLines) {
      const got = preview.payableLines.map((p) => ({ producerId: p.producerId, productId: p.productId, acceptedQty: p.acceptedQty, value: p.value }));
      if (JSON.stringify(got) !== JSON.stringify(f.payableLines)) failures.push(`fechamento payableLines=${JSON.stringify(got)}`);
    }
    if (f.closedShortages) {
      const got = preview.closedShortages.map((s) => ({ schoolId: s.schoolId, productId: s.productId, qty: s.qty }));
      if (JSON.stringify(got) !== JSON.stringify(f.closedShortages)) failures.push(`fechamento closedShortages=${JSON.stringify(got)}`);
    }
  }
  for (const [unit, exp] of Object.entries(c.totaisPorUnidade ?? {})) {
    const got = summary.totalsByUnit[unit as Unit];
    for (const [k, v] of Object.entries(exp ?? {})) if (got?.[k as keyof QtyTotals] !== v) failures.push(`totais ${unit}.${k}=${String(got?.[k as keyof QtyTotals])}, esperado ${v}`);
  }
  for (const [unit, exp] of Object.entries(c.atendimentoPorUnidade ?? {})) {
    if (summary.attendanceByUnit[unit as Unit] !== exp) failures.push(`atendimento ${unit}=${summary.attendanceByUnit[unit as Unit]}, esperado ${exp}`);
  }
  return failures;
}

export function runCalculationCase(c: CalculationCase): number {
  const e = c.entrada as Record<string, never>;
  switch (c.funcao) {
    case "producerPayable":
      return producerPayable(e.acceptedQty, e.price, e.logisticsDeductionSnapshot);
    case "schoolReceivable":
      return schoolReceivable(e.acceptedQty, e.price);
    case "treasuryTotalPerLine":
      return treasuryTotalPerLine(e.lines);
    case "treasuryTotal":
      return round2(treasuryTotal(e.lines));
  }
}
