// Núcleo de quantidades e responsabilidades do ciclo (specs/008-recebimentos-faltas-fechamento).
// Funções puras: ainda NÃO há persistência para entrega por escola/produto,
// complementos nem decisão de falta — isso depende do Lucas (ver spec 008,
// plan.md). Nada aqui deve ser usado para gravar ou exibir valores oficiais
// antes dessa fonte existir.

import { round2 } from "../calc";

// null = não informado (conferência pendente); 0 = zero confirmado.
export type ConferredQty = number | null;

export type ValidationError = { field: string; message: string };

function isNegative(value: number | null | undefined): boolean {
  return typeof value === "number" && value < 0;
}

// ---------------------------------------------------------------- galpão

export interface WarehouseReceiptInput {
  producerId: string;
  productId: string;
  grossQty: ConferredQty;
  rejectedQty: number;
}

export type WarehouseReceiptResult =
  | { status: "NAO_CONFERIDO"; acceptedQty: null; rejectedQty: number; errors: [] }
  | { status: "CONFERIDO"; acceptedQty: number; rejectedQty: number; errors: [] }
  | { status: "ERRO"; acceptedQty: null; rejectedQty: number; errors: ValidationError[] };

// Aceito no galpão = entrega bruta − rejeição no galpão. É a base do
// pagamento ao produtor. Ausência de entrega não é rejeição.
export function evaluateWarehouseReceipt(input: WarehouseReceiptInput): WarehouseReceiptResult {
  const errors: ValidationError[] = [];
  if (isNegative(input.grossQty)) errors.push({ field: "grossQty", message: "Entrega bruta não pode ser negativa." });
  if (isNegative(input.rejectedQty)) errors.push({ field: "rejectedQty", message: "Rejeição não pode ser negativa." });
  if (input.grossQty === null && input.rejectedQty > 0) {
    errors.push({ field: "rejectedQty", message: "Não há rejeição sem entrega bruta conferida." });
  }
  if (input.grossQty !== null && input.rejectedQty > input.grossQty) {
    errors.push({ field: "rejectedQty", message: "Rejeição no galpão maior que a entrega bruta." });
  }
  if (errors.length) return { status: "ERRO", acceptedQty: null, rejectedQty: input.rejectedQty, errors };
  if (input.grossQty === null) return { status: "NAO_CONFERIDO", acceptedQty: null, rejectedQty: 0, errors: [] };
  return { status: "CONFERIDO", acceptedQty: round2(input.grossQty - input.rejectedQty), rejectedQty: input.rejectedQty, errors: [] };
}

export function producerPayable(acceptedAtWarehouseQty: number, price: number, logisticsDeductionSnapshot: number): number {
  return round2(acceptedAtWarehouseQty * round2(price - logisticsDeductionSnapshot));
}

// ---------------------------------------------------------------- escola

export type SchoolEventKind = "INICIAL" | "COMPLEMENTO";

export interface SchoolDeliveryEventInput {
  kind: SchoolEventKind;
  // Quantidade apresentada à escola na entrega (bruta). null = não informado.
  presentedQty: ConferredQty;
  // Rejeitado pela escola na conferência — perda da cooperativa.
  rejectedQty: number;
  // Perda de transporte/manuseio registrada ANTES da apresentação. Não é
  // rejeição da escola e não entra em presentedQty.
  lossBeforeSchoolQty?: number;
  // Produtor de origem do fornecimento, quando conhecido (complementos).
  sourceProducerId?: string | null;
}

export type ShortageDecision =
  | { kind: "EM_RESOLUCAO"; reason?: string }
  | { kind: "ENCERRADA_SEM_ATENDIMENTO"; reason: string; shortageQtyAtDecision: number };

export interface SchoolLineInput {
  schoolId: string;
  productId: string;
  orderedQty: number;
  events: SchoolDeliveryEventInput[];
  shortageDecision?: ShortageDecision | null;
}

export type ReceiptStatus = "SEM_PEDIDO" | "PENDENTE_CONFERENCIA" | "CONFERIDO" | "ERRO";
export type AttendanceStatus = "SEM_PEDIDO" | "OK" | "FALTA" | "EXCEDENTE";
export type ShortageStatus =
  | "NAO_APLICAVEL"
  | "SEM_DECISAO"
  | "EM_RESOLUCAO"
  | "ENCERRADA_SEM_ATENDIMENTO"
  | "DECISAO_INCOERENTE";

export type LineBlocker =
  | "RECEBIMENTO_NAO_CONFERIDO"
  | "ENTREGA_INICIAL_NAO_INFORMADA"
  | "FALTA_SEM_DECISAO"
  | "FALTA_EM_RESOLUCAO"
  | "DECISAO_INCOERENTE"
  | "ERRO_DE_VALIDACAO";

export interface SchoolLineResult {
  schoolId: string;
  productId: string;
  orderedQty: number;
  receiptStatus: ReceiptStatus;
  // Soma do aceito nos eventos conferidos. Se a linha ainda tem conferência
  // pendente, é um valor PARCIAL, não o aceito final.
  acceptedQty: number;
  presentedQty: number;
  rejectedAtSchoolQty: number;
  lossBeforeSchoolQty: number;
  shortageQty: number;
  excessQty: number;
  attendance: AttendanceStatus;
  shortageStatus: ShortageStatus;
  // Valor calculável: só quando todos os eventos da linha foram conferidos.
  valueCalculable: boolean;
  readyToClose: boolean;
  blockers: LineBlocker[];
  errors: ValidationError[];
}

// Falta = max(pedido − aceito, 0). Excedente = max(aceito − pedido, 0).
export function shortageOf(orderedQty: number, acceptedQty: number): number {
  return round2(Math.max(orderedQty - acceptedQty, 0));
}

export function excessOf(orderedQty: number, acceptedQty: number): number {
  return round2(Math.max(acceptedQty - orderedQty, 0));
}

export function evaluateSchoolLine(input: SchoolLineInput): SchoolLineResult {
  const errors: ValidationError[] = [];
  if (isNegative(input.orderedQty)) errors.push({ field: "orderedQty", message: "Pedido não pode ser negativo." });

  let presented = 0;
  let rejected = 0;
  let loss = 0;
  let accepted = 0;
  let pending = false;

  input.events.forEach((event, i) => {
    const label = `${event.kind === "INICIAL" ? "Entrega" : "Complemento"} #${i + 1}`;
    if (isNegative(event.presentedQty)) errors.push({ field: `events.${i}.presentedQty`, message: `${label}: quantidade negativa.` });
    if (isNegative(event.rejectedQty)) errors.push({ field: `events.${i}.rejectedQty`, message: `${label}: rejeição negativa.` });
    if (isNegative(event.lossBeforeSchoolQty)) errors.push({ field: `events.${i}.lossBeforeSchoolQty`, message: `${label}: perda negativa.` });
    if (event.presentedQty === null) {
      if (event.rejectedQty > 0) errors.push({ field: `events.${i}.rejectedQty`, message: `${label}: rejeição sem entrega conferida.` });
      pending = true;
      loss += event.lossBeforeSchoolQty ?? 0;
      return;
    }
    // A rejeição escolar é limitada pela entrega real, não pelo pedido.
    if (event.rejectedQty > event.presentedQty) {
      errors.push({ field: `events.${i}.rejectedQty`, message: `${label}: rejeição maior que a quantidade apresentada.` });
    }
    presented += event.presentedQty;
    rejected += event.rejectedQty;
    loss += event.lossBeforeSchoolQty ?? 0;
    accepted += event.presentedQty - event.rejectedQty;
  });

  const initialEvents = input.events.filter((e) => e.kind === "INICIAL");
  if (initialEvents.length > 1) {
    errors.push({ field: "events", message: "Mais de uma entrega inicial para a mesma escola/produto no ciclo." });
  }

  accepted = round2(accepted);
  const orderedQty = round2(input.orderedQty);
  const shortageQty = shortageOf(orderedQty, accepted);
  const excessQty = excessOf(orderedQty, accepted);

  const noMovement = orderedQty === 0 && input.events.length === 0;
  const blockers: LineBlocker[] = [];
  const initialMissing = orderedQty > 0 && initialEvents.length === 0;

  let receiptStatus: ReceiptStatus;
  if (errors.length) receiptStatus = "ERRO";
  else if (noMovement) receiptStatus = "SEM_PEDIDO";
  else if (pending || initialMissing) receiptStatus = "PENDENTE_CONFERENCIA";
  else receiptStatus = "CONFERIDO";

  if (errors.length) blockers.push("ERRO_DE_VALIDACAO");
  if (pending) blockers.push("RECEBIMENTO_NAO_CONFERIDO");
  if (initialMissing) blockers.push("ENTREGA_INICIAL_NAO_INFORMADA");

  let attendance: AttendanceStatus;
  if (noMovement) attendance = "SEM_PEDIDO";
  else if (shortageQty > 0) attendance = "FALTA";
  else if (excessQty > 0) attendance = "EXCEDENTE";
  else attendance = "OK";

  // A situação da falta só é avaliada com a conferência completa: um valor
  // parcial não pode ser encerrado.
  let shortageStatus: ShortageStatus = "NAO_APLICAVEL";
  const decision = input.shortageDecision ?? null;
  if (receiptStatus === "CONFERIDO") {
    if (shortageQty > 0) {
      if (!decision) shortageStatus = "SEM_DECISAO";
      else if (decision.kind === "EM_RESOLUCAO") shortageStatus = "EM_RESOLUCAO";
      else if (decision.shortageQtyAtDecision !== shortageQty || !decision.reason.trim()) shortageStatus = "DECISAO_INCOERENTE";
      else shortageStatus = "ENCERRADA_SEM_ATENDIMENTO";
    } else if (decision?.kind === "ENCERRADA_SEM_ATENDIMENTO") {
      // Uma falta encerrada que deixou de existir (ex.: complemento
      // posterior) precisa ser revista — não some em silêncio.
      shortageStatus = "DECISAO_INCOERENTE";
    }
  }
  if (shortageStatus === "SEM_DECISAO") blockers.push("FALTA_SEM_DECISAO");
  if (shortageStatus === "EM_RESOLUCAO") blockers.push("FALTA_EM_RESOLUCAO");
  if (shortageStatus === "DECISAO_INCOERENTE") blockers.push("DECISAO_INCOERENTE");

  return {
    schoolId: input.schoolId,
    productId: input.productId,
    orderedQty,
    receiptStatus,
    acceptedQty: accepted,
    presentedQty: round2(presented),
    rejectedAtSchoolQty: round2(rejected),
    lossBeforeSchoolQty: round2(loss),
    shortageQty,
    excessQty,
    attendance,
    shortageStatus,
    valueCalculable: receiptStatus === "CONFERIDO" || receiptStatus === "SEM_PEDIDO",
    readyToClose: blockers.length === 0,
    blockers,
    errors,
  };
}

// A prefeitura paga pelo aceito na escola (entregas + complementos − rejeições).
export function schoolReceivable(acceptedAtSchoolQty: number, price: number): number {
  return round2(acceptedAtSchoolQty * price);
}

// ---------------------------------------------------------------- ciclo

export type CycleState = "AGUARDANDO_PEDIDO" | "EM_CONFERENCIA" | "AGUARDANDO_DECISOES" | "COM_ERROS" | "PRONTO_PARA_FECHAR";

export interface CycleInput {
  schoolLines: SchoolLineInput[];
  warehouseReceipts: WarehouseReceiptInput[];
}

export interface CycleSummary {
  state: CycleState;
  // Os três indicadores são independentes de propósito: um ciclo pode ter
  // recebimentos conferidos e valores calculados e ainda assim não estar
  // pronto (faltas sem decisão).
  receiptsConferred: boolean;
  valuesCalculated: boolean;
  readyToClose: boolean;
  counts: {
    schoolLinesPending: number;
    warehousePending: number;
    shortagesWithoutDecision: number;
    shortagesInResolution: number;
    shortagesClosedWithoutService: number;
    incoherentDecisions: number;
    errors: number;
  };
  totals: {
    orderedQty: number;
    acceptedAtSchoolQty: number;
    shortageQty: number;
    shortageClosedQty: number;
    excessQty: number;
    rejectedAtWarehouseQty: number;
    acceptedAtWarehouseQty: number;
    rejectedAtSchoolQty: number;
    lossBeforeSchoolQty: number;
  };
  schoolLines: SchoolLineResult[];
  warehouseReceipts: (WarehouseReceiptInput & { result: WarehouseReceiptResult })[];
}

export function summarizeCycle(input: CycleInput): CycleSummary {
  const schoolLines = input.schoolLines.map(evaluateSchoolLine);
  const warehouseReceipts = input.warehouseReceipts.map((r) => ({ ...r, result: evaluateWarehouseReceipt(r) }));

  const count = (pred: (l: SchoolLineResult) => boolean) => schoolLines.filter(pred).length;
  const sum = (values: number[]) => round2(values.reduce((a, b) => a + b, 0));

  const counts = {
    schoolLinesPending: count((l) => l.receiptStatus === "PENDENTE_CONFERENCIA"),
    warehousePending: warehouseReceipts.filter((r) => r.result.status === "NAO_CONFERIDO").length,
    shortagesWithoutDecision: count((l) => l.shortageStatus === "SEM_DECISAO"),
    shortagesInResolution: count((l) => l.shortageStatus === "EM_RESOLUCAO"),
    shortagesClosedWithoutService: count((l) => l.shortageStatus === "ENCERRADA_SEM_ATENDIMENTO"),
    incoherentDecisions: count((l) => l.shortageStatus === "DECISAO_INCOERENTE"),
    errors: count((l) => l.receiptStatus === "ERRO") + warehouseReceipts.filter((r) => r.result.status === "ERRO").length,
  };

  const hasMovement = schoolLines.some((l) => l.receiptStatus !== "SEM_PEDIDO") || warehouseReceipts.length > 0;
  const receiptsConferred = counts.schoolLinesPending === 0 && counts.warehousePending === 0 && counts.errors === 0;
  const valuesCalculated = receiptsConferred && hasMovement;
  const decisionsOpen = counts.shortagesWithoutDecision + counts.shortagesInResolution + counts.incoherentDecisions;

  let state: CycleState;
  if (!hasMovement) state = "AGUARDANDO_PEDIDO";
  else if (counts.errors > 0) state = "COM_ERROS";
  else if (!receiptsConferred) state = "EM_CONFERENCIA";
  else if (decisionsOpen > 0) state = "AGUARDANDO_DECISOES";
  else state = "PRONTO_PARA_FECHAR";

  const acceptedWarehouse = warehouseReceipts.map((r) => (r.result.status === "CONFERIDO" ? r.result.acceptedQty : 0));

  return {
    state,
    receiptsConferred,
    valuesCalculated,
    readyToClose: state === "PRONTO_PARA_FECHAR",
    counts,
    totals: {
      orderedQty: sum(schoolLines.map((l) => l.orderedQty)),
      acceptedAtSchoolQty: sum(schoolLines.map((l) => l.acceptedQty)),
      shortageQty: sum(schoolLines.map((l) => l.shortageQty)),
      shortageClosedQty: sum(schoolLines.filter((l) => l.shortageStatus === "ENCERRADA_SEM_ATENDIMENTO").map((l) => l.shortageQty)),
      excessQty: sum(schoolLines.map((l) => l.excessQty)),
      rejectedAtWarehouseQty: sum(warehouseReceipts.map((r) => (r.result.status === "CONFERIDO" ? r.result.rejectedQty : 0))),
      acceptedAtWarehouseQty: sum(acceptedWarehouse),
      rejectedAtSchoolQty: sum(schoolLines.map((l) => l.rejectedAtSchoolQty)),
      lossBeforeSchoolQty: sum(schoolLines.map((l) => l.lossBeforeSchoolQty)),
    },
    schoolLines,
    warehouseReceipts,
  };
}

// Saldo entre o que o galpão aceitou e o que foi apresentado às escolas
// (mais perdas registradas antes da escola), por produto. Positivo não é
// perda nem estoque: pode ser produto ainda não entregue, sobra ou
// conferência pendente — exibir como "saldo a conferir".
export function warehouseToSchoolBalance(acceptedAtWarehouseQty: number, presentedToSchoolsQty: number, lossBeforeSchoolQty: number): number {
  return round2(acceptedAtWarehouseQty - presentedToSchoolsQty - lossBeforeSchoolQty);
}

// Percentual de atendimento: cada linha contribui no máximo com o próprio
// pedido (excesso de uma escola/produto não cobre falta de outra). Demanda
// zero → não aplicável (null).
export function attendanceRate(lines: { orderedQty: number; acceptedQty: number }[]): number | null {
  const demand = lines.reduce((s, l) => s + l.orderedQty, 0);
  if (demand <= 0) return null;
  const served = lines.reduce((s, l) => s + Math.min(l.acceptedQty, l.orderedQty), 0);
  return round2((served / demand) * 100);
}
