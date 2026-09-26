// Complementos e encerramento de faltas (specs/008-recebimentos-faltas-fechamento,
// RN-06, RN-09, RN-11; prompt v2 §7 e §8).
//
// Registro de eventos do ciclo por escola/produto e comandos que o alteram.
// Tudo aqui é puro: recebe o estado, devolve o novo estado, a auditoria e os
// avisos. NÃO há persistência — as tabelas de evento de entrega, complemento
// e decisão de falta ainda não existem (dependem do Lucas; ver
// docs/propostas-pendentes.md §9). Nada daqui grava ou alimenta valor oficial.

import { round2 } from "../calc";
import {
  closingPreview,
  evaluateSchoolLine,
  warehouseToSchoolBalance,
  type ClosingPreview,
  type ConferredQty,
  type CycleInput,
  type SchoolEventKind,
  type SchoolLineInput,
  type SchoolLineResult,
  type ShortageDecision,
  type Unit,
  type WarehouseReceiptInput,
} from "./cycle";

// ---------------------------------------------------------------- tipos

// De onde veio o produto de um complemento. Sempre explícito: o app não
// presume que o produtor original fez a reposição.
export type SupplySource = { type: "PRODUTOR"; producerId: string } | { type: "SALDO_GALPAO" };

export interface DeliveryEvent {
  id: string;
  kind: SchoolEventKind;
  schoolId: string;
  productId: string;
  // null = não informado (conferência pendente); 0 = zero confirmado.
  presentedQty: ConferredQty;
  rejectedQty: number;
  rejectionReason: string | null;
  lossBeforeSchoolQty: number;
  lossReason: string | null;
  source: SupplySource | null;
  // Data e horário reais da entrega (romaneio), separados do horário de lançamento.
  deliveredAt: string | null;
  receivedBy: string | null;
  idempotencyKey: string;
  version: number;
  createdBy: string;
  createdAt: string;
}

export interface ShortageDecisionRecord {
  schoolId: string;
  productId: string;
  kind: ShortageDecision["kind"];
  reason: string;
  // Só em ENCERRADA_SEM_ATENDIMENTO: a falta no momento da decisão.
  shortageQtyAtDecision: number | null;
  decidedBy: string;
  decidedAt: string;
  version: number;
}

export interface SchoolOrderLine {
  schoolId: string;
  productId: string;
  orderedQty: number;
  unit: Unit;
  // Preço congelado do pedido.
  price: number | null;
}

export interface AuditEntry {
  at: string;
  actorId: string;
  action: CycleCommand["type"];
  schoolId: string;
  productId: string;
  eventId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

export interface CycleLedger {
  cycleId: string;
  status: "ABERTO" | "FECHADO";
  orders: SchoolOrderLine[];
  // Recebimento no galpão (hoje: ProducerDelivery/ProducerReturn). Somente
  // leitura aqui — serve para conferir a origem dos complementos.
  warehouseReceipts: WarehouseReceiptInput[];
  events: DeliveryEvent[];
  decisions: ShortageDecisionRecord[];
  audit: AuditEntry[];
}

export type ActorRole = "ADMIN" | "OPERADOR" | "CONSULTA";
export interface Actor {
  id: string;
  role: ActorRole;
}

export interface EventFields {
  presentedQty: ConferredQty;
  rejectedQty: number;
  rejectionReason?: string | null;
  lossBeforeSchoolQty?: number;
  lossReason?: string | null;
  source?: SupplySource | null;
  deliveredAt?: string | null;
  receivedBy?: string | null;
}

export type CycleCommand =
  | ({ type: "REGISTRAR_ENTREGA_INICIAL"; idempotencyKey: string; schoolId: string; productId: string } & EventFields)
  | ({ type: "REGISTRAR_COMPLEMENTO"; idempotencyKey: string; schoolId: string; productId: string } & EventFields & { source: SupplySource })
  | { type: "CORRIGIR_EVENTO"; eventId: string; expectedVersion: number; changes: Partial<EventFields>; reason: string }
  | { type: "MARCAR_FALTA_EM_RESOLUCAO"; schoolId: string; productId: string; reason?: string; expectedVersion: number | null }
  | { type: "ENCERRAR_FALTA_SEM_ATENDIMENTO"; schoolId: string; productId: string; reason: string; expectedShortageQty: number; expectedVersion: number | null }
  | { type: "REVOGAR_DECISAO_FALTA"; schoolId: string; productId: string; reason: string; expectedVersion: number };

export type CommandErrorCode = "CICLO_FECHADO" | "SEM_PERMISSAO" | "INVALIDO" | "CONFLITO" | "NAO_ENCONTRADO";

export type CommandResult =
  | { ok: true; ledger: CycleLedger; effect: "APLICADO" | "JA_REGISTRADO"; warnings: string[]; audit: AuditEntry[] }
  | { ok: false; code: CommandErrorCode; error: string };

export interface CommandContext {
  now: string;
  newId: () => string;
}

// ---------------------------------------------------------------- leitura

const lineKey = (schoolId: string, productId: string) => `${schoolId}:${productId}`;

function toDecision(record: ShortageDecisionRecord | undefined): ShortageDecision | null {
  if (!record) return null;
  if (record.kind === "EM_RESOLUCAO") return { kind: "EM_RESOLUCAO", reason: record.reason };
  return { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: record.reason, shortageQtyAtDecision: record.shortageQtyAtDecision ?? 0 };
}

// Converte o registro de eventos nas linhas que o núcleo (cycle.ts) avalia.
export function schoolLineInputs(ledger: CycleLedger): SchoolLineInput[] {
  const keys = new Map<string, { schoolId: string; productId: string }>();
  for (const o of ledger.orders) keys.set(lineKey(o.schoolId, o.productId), o);
  for (const e of ledger.events) keys.set(lineKey(e.schoolId, e.productId), e);
  return [...keys.values()].map(({ schoolId, productId }) => {
    const order = ledger.orders.find((o) => o.schoolId === schoolId && o.productId === productId);
    const events = ledger.events
      .filter((e) => e.schoolId === schoolId && e.productId === productId)
      .map((e) => ({
        kind: e.kind,
        presentedQty: e.presentedQty,
        rejectedQty: e.rejectedQty,
        lossBeforeSchoolQty: e.lossBeforeSchoolQty,
        sourceProducerId: e.source?.type === "PRODUTOR" ? e.source.producerId : null,
      }));
    return {
      schoolId,
      productId,
      orderedQty: order?.orderedQty ?? 0,
      unit: order?.unit ?? "kg",
      price: order?.price ?? undefined,
      events,
      shortageDecision: toDecision(ledger.decisions.find((d) => d.schoolId === schoolId && d.productId === productId)),
    };
  });
}

export function evaluateLedgerLine(ledger: CycleLedger, schoolId: string, productId: string): SchoolLineResult {
  const input = schoolLineInputs(ledger).find((l) => l.schoolId === schoolId && l.productId === productId);
  return evaluateSchoolLine(input ?? { schoolId, productId, orderedQty: 0, events: [] });
}

export function cycleInput(ledger: CycleLedger): CycleInput {
  return { schoolLines: schoolLineInputs(ledger), warehouseReceipts: ledger.warehouseReceipts };
}

// ---------------------------------------------------------------- integridade galpão × escola

export interface SupplyIssue {
  severity: "BLOQUEIO" | "AVISO";
  productId: string;
  producerId?: string;
  message: string;
}

function acceptedAtWarehouse(ledger: CycleLedger, productId: string, producerId?: string): number {
  return round2(
    ledger.warehouseReceipts
      .filter((r) => r.productId === productId && (producerId === undefined || r.producerId === producerId))
      .reduce((sum, r) => (r.grossQty === null ? sum : sum + Math.max(r.grossQty - r.rejectedQty, 0)), 0),
  );
}

function hasConferredReceipt(ledger: CycleLedger, productId: string, producerId: string): boolean {
  return ledger.warehouseReceipts.some((r) => r.productId === productId && r.producerId === producerId && r.grossQty !== null);
}

// - Complemento de um produtor sem recebimento conferido desse produtor no
//   galpão: BLOQUEIO (o produtor não seria pago pelo que forneceu).
// - Escolas receberam mais do que o galpão aceitou num produto: AVISO de
//   "saldo a conferir" — pode faltar lançamento no galpão ou haver sobra de
//   outro ciclo; o app não inventa estoque nem causa.
export function supplyIssues(ledger: CycleLedger): SupplyIssue[] {
  const issues: SupplyIssue[] = [];
  const seen = new Set<string>();
  for (const e of ledger.events) {
    if (e.kind !== "COMPLEMENTO" || e.source?.type !== "PRODUTOR") continue;
    const key = lineKey(e.source.producerId, e.productId);
    if (seen.has(key) || hasConferredReceipt(ledger, e.productId, e.source.producerId)) continue;
    seen.add(key);
    issues.push({
      severity: "BLOQUEIO",
      productId: e.productId,
      producerId: e.source.producerId,
      message: "Complemento de produtor sem recebimento conferido no galpão: registre o recebimento para que ele seja pago pelo que forneceu.",
    });
  }
  const products = [...new Set(ledger.events.map((e) => e.productId))];
  for (const productId of products) {
    const events = ledger.events.filter((e) => e.productId === productId);
    const presented = round2(events.reduce((s, e) => s + (e.presentedQty ?? 0), 0));
    const loss = round2(events.reduce((s, e) => s + e.lossBeforeSchoolQty, 0));
    const balance = warehouseToSchoolBalance(acceptedAtWarehouse(ledger, productId), presented, loss);
    if (balance < 0) {
      issues.push({
        severity: "AVISO",
        productId,
        message: `Escolas receberam ${round2(-balance)} a mais do que o galpão aceitou. Saldo a conferir: falta lançar recebimento no galpão ou corrigir a entrega.`,
      });
    }
  }
  return issues;
}

export interface LedgerClosingPreview extends ClosingPreview {
  warnings: string[];
  supplyIssues: SupplyIssue[];
}

// Prévia de fechamento do núcleo acrescida da conferência de origem dos
// complementos. Não fecha nada.
export function ledgerClosingPreview(ledger: CycleLedger): LedgerClosingPreview {
  const preview = closingPreview(cycleInput(ledger));
  const issues = supplyIssues(ledger);
  const blocking = issues.filter((i) => i.severity === "BLOQUEIO");
  const blockers = [...preview.blockers];
  if (blocking.length) blockers.push(`${blocking.length} complemento(s) sem recebimento conferido no galpão do produtor de origem.`);
  if (ledger.status === "FECHADO") blockers.push("Ciclo já fechado.");
  return {
    ...preview,
    blockers,
    canClose: preview.canClose && blocking.length === 0 && ledger.status === "ABERTO",
    warnings: issues.filter((i) => i.severity === "AVISO").map((i) => i.message),
    supplyIssues: issues,
  };
}

// ---------------------------------------------------------------- validação

const hasAtMostTwoDecimals = (n: number) => Math.abs(round2(n) - n) < 1e-9;
const blank = (s: string | null | undefined) => !s || !s.trim();

function validateQty(label: string, value: number | null | undefined, errors: string[]) {
  if (value === null || value === undefined) return;
  if (!Number.isFinite(value) || value < 0) errors.push(`${label} deve ser um número maior ou igual a zero.`);
  else if (!hasAtMostTwoDecimals(value)) errors.push(`${label} aceita no máximo 2 casas decimais.`);
}

function validateEvent(e: Omit<DeliveryEvent, "id" | "version" | "createdBy" | "createdAt" | "idempotencyKey">, previous?: DeliveryEvent): string[] {
  const errors: string[] = [];
  validateQty("Quantidade entregue", e.presentedQty, errors);
  validateQty("Rejeição", e.rejectedQty, errors);
  validateQty("Perda antes da escola", e.lossBeforeSchoolQty, errors);
  if (errors.length) return errors;
  if (e.presentedQty === null && e.rejectedQty > 0) errors.push("Não há rejeição sem quantidade entregue conferida.");
  if (e.presentedQty !== null && e.rejectedQty > e.presentedQty) {
    errors.push(
      previous && previous.rejectedQty === e.rejectedQty
        ? `Não é possível reduzir a entrega para ${e.presentedQty}: já há ${e.rejectedQty} de rejeição registrada. Corrija a rejeição primeiro.`
        : "Rejeição da escola maior que a quantidade entregue.",
    );
  }
  if (e.rejectedQty > 0 && blank(e.rejectionReason)) errors.push("Informe o motivo da rejeição (ou \"Motivo não identificado\").");
  if (e.lossBeforeSchoolQty > 0 && blank(e.lossReason)) errors.push("Informe o motivo da perda antes da escola (ou \"Motivo não identificado\").");
  if (e.kind === "COMPLEMENTO") {
    if (!e.source) errors.push("Informe de onde veio o complemento (produtor ou saldo do galpão).");
    else if (e.source.type === "PRODUTOR" && blank(e.source.producerId)) errors.push("Informe o produtor do complemento.");
    if (e.presentedQty === null || e.presentedQty <= 0) errors.push("Complemento precisa de quantidade entregue maior que zero.");
  }
  return errors;
}

function eventSnapshot(e: DeliveryEvent): Record<string, unknown> {
  return {
    presentedQty: e.presentedQty,
    rejectedQty: e.rejectedQty,
    rejectionReason: e.rejectionReason,
    lossBeforeSchoolQty: e.lossBeforeSchoolQty,
    lossReason: e.lossReason,
    source: e.source,
    deliveredAt: e.deliveredAt,
    receivedBy: e.receivedBy,
  };
}

function sameFields(a: DeliveryEvent, b: Omit<DeliveryEvent, "id" | "version" | "createdBy" | "createdAt">): boolean {
  return a.kind === b.kind && a.schoolId === b.schoolId && a.productId === b.productId && JSON.stringify(eventSnapshot(a)) === JSON.stringify(eventSnapshot(b as DeliveryEvent));
}

// Decisões que ficaram incoerentes por causa da alteração (RN-11).
function decisionWarnings(before: SchoolLineResult, after: SchoolLineResult, decision: ShortageDecisionRecord | undefined): string[] {
  const warnings: string[] = [];
  if (after.shortageStatus === "DECISAO_INCOERENTE" && before.shortageStatus !== "DECISAO_INCOERENTE" && decision) {
    warnings.push(
      after.shortageQty === 0
        ? `A falta encerrada (${decision.shortageQtyAtDecision}) deixou de existir. Revogue a decisão de encerramento.`
        : `A decisão de encerrar a falta de ${decision.shortageQtyAtDecision} ficou incoerente: a falta agora é ${after.shortageQty}. Revise a decisão.`,
    );
  }
  if (decision?.kind === "EM_RESOLUCAO" && after.shortageQty === 0 && after.receiptStatus === "CONFERIDO") {
    warnings.push("A falta em resolução foi coberta. Revogue a marcação \"em resolução\".");
  }
  return warnings;
}

// ---------------------------------------------------------------- comandos

function fail(code: CommandErrorCode, error: string): CommandResult {
  return { ok: false, code, error };
}

export function executeCommand(ledger: CycleLedger, command: CycleCommand, actor: Actor, ctx: CommandContext): CommandResult {
  if (ledger.status === "FECHADO") return fail("CICLO_FECHADO", "Ciclo fechado: nada pode ser alterado.");
  if (actor.role !== "ADMIN" && actor.role !== "OPERADOR") return fail("SEM_PERMISSAO", "Seu perfil só pode consultar.");

  switch (command.type) {
    case "REGISTRAR_ENTREGA_INICIAL":
    case "REGISTRAR_COMPLEMENTO":
      return registerEvent(ledger, command, actor, ctx);
    case "CORRIGIR_EVENTO":
      return correctEvent(ledger, command, actor, ctx);
    default:
      return decide(ledger, command, actor, ctx);
  }
}

function registerEvent(
  ledger: CycleLedger,
  command: Extract<CycleCommand, { type: "REGISTRAR_ENTREGA_INICIAL" | "REGISTRAR_COMPLEMENTO" }>,
  actor: Actor,
  ctx: CommandContext,
): CommandResult {
  const kind: SchoolEventKind = command.type === "REGISTRAR_COMPLEMENTO" ? "COMPLEMENTO" : "INICIAL";
  if (blank(command.idempotencyKey)) return fail("INVALIDO", "Registro sem identificador de envio.");
  const draft = {
    kind,
    schoolId: command.schoolId,
    productId: command.productId,
    presentedQty: command.presentedQty,
    rejectedQty: command.rejectedQty ?? 0,
    rejectionReason: command.rejectionReason?.trim() || null,
    lossBeforeSchoolQty: command.lossBeforeSchoolQty ?? 0,
    lossReason: command.lossReason?.trim() || null,
    source: command.source ?? null,
    deliveredAt: command.deliveredAt ?? null,
    receivedBy: command.receivedBy?.trim() || null,
    idempotencyKey: command.idempotencyKey,
  };

  // Reenvio ou duplo clique: mesmo identificador → nada muda.
  const repeated = ledger.events.find((e) => e.idempotencyKey === command.idempotencyKey);
  if (repeated) {
    if (sameFields(repeated, draft)) return { ok: true, ledger, effect: "JA_REGISTRADO", warnings: [], audit: [] };
    return fail("CONFLITO", "Este envio já foi registrado com outros valores. Recarregue antes de tentar de novo.");
  }

  const order = ledger.orders.find((o) => o.schoolId === command.schoolId && o.productId === command.productId);
  if (!order || order.orderedQty <= 0) return fail("INVALIDO", "Não há pedido desta escola para este produto no ciclo.");

  const existing = ledger.events.filter((e) => e.schoolId === command.schoolId && e.productId === command.productId);
  if (kind === "INICIAL" && existing.some((e) => e.kind === "INICIAL")) {
    return fail("CONFLITO", "Já existe entrega inicial para esta escola e produto. Para mudar valores, corrija o lançamento (correção não é nova entrega).");
  }
  const errors = validateEvent(draft);
  if (errors.length) return fail("INVALIDO", errors.join(" "));

  const before = evaluateLedgerLine(ledger, command.schoolId, command.productId);
  const event: DeliveryEvent = { ...draft, id: ctx.newId(), version: 1, createdBy: actor.id, createdAt: ctx.now };
  const audit: AuditEntry = {
    at: ctx.now,
    actorId: actor.id,
    action: command.type,
    schoolId: command.schoolId,
    productId: command.productId,
    eventId: event.id,
    before: null,
    after: eventSnapshot(event),
    reason: null,
  };
  const next: CycleLedger = { ...ledger, events: [...ledger.events, event], audit: [...ledger.audit, audit] };
  const after = evaluateLedgerLine(next, command.schoolId, command.productId);

  const warnings: string[] = [];
  if (kind === "COMPLEMENTO") {
    if (before.receiptStatus === "CONFERIDO" && before.shortageQty === 0) warnings.push("Não havia falta nesta linha: o complemento gera excedente.");
    else if (after.excessQty > 0) warnings.push(`O complemento deixa excedente de ${after.excessQty} ${after.unit} (não é cortado).`);
    if (after.receiptStatus === "PENDENTE_CONFERENCIA") {
      warnings.push("A entrega inicial continua pendente. Se não houve entrega inicial, registre zero confirmado.");
    }
    if (event.source?.type === "PRODUTOR" && !hasConferredReceipt(next, event.productId, event.source.producerId)) {
      warnings.push("O produtor do complemento não tem recebimento conferido no galpão para este produto: registre para que ele seja pago.");
    }
  }
  warnings.push(...decisionWarnings(before, after, ledger.decisions.find((d) => d.schoolId === command.schoolId && d.productId === command.productId)));
  return { ok: true, ledger: next, effect: "APLICADO", warnings, audit: [audit] };
}

function correctEvent(ledger: CycleLedger, command: Extract<CycleCommand, { type: "CORRIGIR_EVENTO" }>, actor: Actor, ctx: CommandContext): CommandResult {
  const current = ledger.events.find((e) => e.id === command.eventId);
  if (!current) return fail("NAO_ENCONTRADO", "Lançamento não encontrado.");
  if (current.version !== command.expectedVersion) {
    return fail("CONFLITO", "Este lançamento foi alterado por outra pessoa depois que você abriu. Recarregue e confira antes de corrigir.");
  }
  if (blank(command.reason)) return fail("INVALIDO", "Informe o motivo da correção.");

  const c = command.changes;
  const merged: DeliveryEvent = {
    ...current,
    presentedQty: c.presentedQty !== undefined ? c.presentedQty : current.presentedQty,
    rejectedQty: c.rejectedQty ?? current.rejectedQty,
    rejectionReason: c.rejectionReason !== undefined ? c.rejectionReason?.trim() || null : current.rejectionReason,
    lossBeforeSchoolQty: c.lossBeforeSchoolQty ?? current.lossBeforeSchoolQty,
    lossReason: c.lossReason !== undefined ? c.lossReason?.trim() || null : current.lossReason,
    source: c.source !== undefined ? c.source : current.source,
    deliveredAt: c.deliveredAt !== undefined ? c.deliveredAt : current.deliveredAt,
    receivedBy: c.receivedBy !== undefined ? c.receivedBy?.trim() || null : current.receivedBy,
    version: current.version + 1,
  };
  if (JSON.stringify(eventSnapshot(merged)) === JSON.stringify(eventSnapshot(current))) {
    return { ok: true, ledger, effect: "JA_REGISTRADO", warnings: [], audit: [] };
  }
  const errors = validateEvent(merged, current);
  if (errors.length) return fail("INVALIDO", errors.join(" "));

  const before = evaluateLedgerLine(ledger, current.schoolId, current.productId);
  const beforeSnap = eventSnapshot(current);
  const afterSnap = eventSnapshot(merged);
  const changedKeys = Object.keys(afterSnap).filter((k) => JSON.stringify(afterSnap[k]) !== JSON.stringify(beforeSnap[k]));
  const audit: AuditEntry = {
    at: ctx.now,
    actorId: actor.id,
    action: "CORRIGIR_EVENTO",
    schoolId: current.schoolId,
    productId: current.productId,
    eventId: current.id,
    before: Object.fromEntries(changedKeys.map((k) => [k, beforeSnap[k]])),
    after: Object.fromEntries(changedKeys.map((k) => [k, afterSnap[k]])),
    reason: command.reason.trim(),
  };
  const next: CycleLedger = { ...ledger, events: ledger.events.map((e) => (e.id === current.id ? merged : e)), audit: [...ledger.audit, audit] };
  const after = evaluateLedgerLine(next, current.schoolId, current.productId);
  const warnings = decisionWarnings(before, after, ledger.decisions.find((d) => d.schoolId === current.schoolId && d.productId === current.productId));
  return { ok: true, ledger: next, effect: "APLICADO", warnings, audit: [audit] };
}

function decide(
  ledger: CycleLedger,
  command: Extract<CycleCommand, { type: "MARCAR_FALTA_EM_RESOLUCAO" | "ENCERRAR_FALTA_SEM_ATENDIMENTO" | "REVOGAR_DECISAO_FALTA" }>,
  actor: Actor,
  ctx: CommandContext,
): CommandResult {
  const { schoolId, productId } = command;
  const current = ledger.decisions.find((d) => d.schoolId === schoolId && d.productId === productId);
  if ((current?.version ?? null) !== command.expectedVersion) {
    return fail("CONFLITO", "A decisão desta falta foi alterada por outra pessoa. Recarregue e confira.");
  }
  const line = evaluateLedgerLine(ledger, schoolId, productId);
  const reason = (command.reason ?? "").trim();
  let record: ShortageDecisionRecord | null;

  if (command.type === "REVOGAR_DECISAO_FALTA") {
    if (!current) return fail("NAO_ENCONTRADO", "Não há decisão para revogar.");
    if (!reason) return fail("INVALIDO", "Informe o motivo da revogação.");
    record = null;
  } else if (command.type === "MARCAR_FALTA_EM_RESOLUCAO") {
    if (line.shortageQty <= 0) return fail("INVALIDO", "Não há falta nesta linha.");
    record = { schoolId, productId, kind: "EM_RESOLUCAO", reason, shortageQtyAtDecision: null, decidedBy: actor.id, decidedAt: ctx.now, version: (current?.version ?? 0) + 1 };
  } else {
    if (line.receiptStatus !== "CONFERIDO") {
      return fail("INVALIDO", "Só é possível encerrar a falta depois de conferir todas as entregas desta escola e produto (vazio não é zero).");
    }
    if (line.shortageQty <= 0) return fail("INVALIDO", "Não há falta a encerrar: o total aceito já cobre o pedido.");
    if (round2(command.expectedShortageQty) !== line.shortageQty) {
      return fail("CONFLITO", `A falta mudou para ${line.shortageQty} ${line.unit} depois que você abriu. Confira antes de encerrar.`);
    }
    if (reason.length < 3) return fail("INVALIDO", "Informe o motivo do encerramento sem atendimento.");
    record = {
      schoolId,
      productId,
      kind: "ENCERRADA_SEM_ATENDIMENTO",
      reason,
      shortageQtyAtDecision: line.shortageQty,
      decidedBy: actor.id,
      decidedAt: ctx.now,
      version: (current?.version ?? 0) + 1,
    };
  }

  const snap = (d: ShortageDecisionRecord | null | undefined) => (d ? { kind: d.kind, reason: d.reason, shortageQtyAtDecision: d.shortageQtyAtDecision } : null);
  const audit: AuditEntry = { at: ctx.now, actorId: actor.id, action: command.type, schoolId, productId, eventId: null, before: snap(current), after: snap(record), reason: reason || null };
  const others = ledger.decisions.filter((d) => !(d.schoolId === schoolId && d.productId === productId));
  const next: CycleLedger = { ...ledger, decisions: record ? [...others, record] : others, audit: [...ledger.audit, audit] };
  return { ok: true, ledger: next, effect: "APLICADO", warnings: [], audit: [audit] };
}
