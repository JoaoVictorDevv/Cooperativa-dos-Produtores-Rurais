// Núcleo de quantidades e responsabilidades do ciclo (specs/008-recebimentos-faltas-fechamento).
// Funções puras: ainda NÃO há persistência para entrega por escola/produto,
// complementos nem decisão de falta — isso depende do Lucas (ver spec 008,
// plan.md). Nada aqui deve ser usado para gravar ou exibir valores oficiais
// antes dessa fonte existir.

import { round2 } from "../calc";

// null = não informado (conferência pendente); 0 = zero confirmado.
export type ConferredQty = number | null;

export type ValidationError = { field: string; message: string };

// Unidade do produto. Quantidades de unidades diferentes nunca são somadas.
export type Unit = "kg" | "dz";

function isNegative(value: number | null | undefined): boolean {
  return typeof value === "number" && value < 0;
}

// ---------------------------------------------------------------- galpão

export interface WarehouseReceiptInput {
  producerId: string;
  productId: string;
  grossQty: ConferredQty;
  rejectedQty: number;
  unit?: Unit;
  // Preço e desconto de logística congelados no lançamento (prévia financeira).
  price?: number;
  logisticsDeductionSnapshot?: number;
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
  unit?: Unit;
  // Preço congelado do pedido (prévia financeira).
  price?: number;
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
  unit: Unit;
  price: number | null;
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
    unit: input.unit ?? "kg",
    price: input.price ?? null,
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

export interface QtyTotals {
  orderedQty: number;
  acceptedAtSchoolQty: number;
  // Só linhas com a entrega conferida: falta parcial de linha pendente não é
  // falta confirmada (vazio não é zero). Linhas pendentes: pendingLines.
  shortageQty: number;
  pendingLines: number;
  shortageClosedQty: number;
  excessQty: number;
  rejectedAtWarehouseQty: number;
  acceptedAtWarehouseQty: number;
  rejectedAtSchoolQty: number;
  lossBeforeSchoolQty: number;
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
  // Totais separados por unidade (kg e dz nunca se somam).
  totalsByUnit: Partial<Record<Unit, QtyTotals>>;
  // Percentual de atendimento por unidade (null = demanda zero, não aplicável).
  attendanceByUnit: Partial<Record<Unit, number | null>>;
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

  const units = new Set<Unit>([...schoolLines.map((l) => l.unit), ...warehouseReceipts.map((r) => r.unit ?? "kg")]);
  const totalsByUnit: Partial<Record<Unit, QtyTotals>> = {};
  const attendanceByUnit: Partial<Record<Unit, number | null>> = {};
  for (const unit of units) {
    const lines = schoolLines.filter((l) => l.unit === unit);
    const receipts = warehouseReceipts.filter((r) => (r.unit ?? "kg") === unit && r.result.status === "CONFERIDO");
    totalsByUnit[unit] = {
      orderedQty: sum(lines.map((l) => l.orderedQty)),
      acceptedAtSchoolQty: sum(lines.map((l) => l.acceptedQty)),
      shortageQty: sum(lines.filter((l) => l.receiptStatus === "CONFERIDO").map((l) => l.shortageQty)),
      pendingLines: lines.filter((l) => l.receiptStatus === "PENDENTE_CONFERENCIA").length,
      shortageClosedQty: sum(lines.filter((l) => l.shortageStatus === "ENCERRADA_SEM_ATENDIMENTO").map((l) => l.shortageQty)),
      excessQty: sum(lines.map((l) => l.excessQty)),
      rejectedAtWarehouseQty: sum(receipts.map((r) => r.result.rejectedQty)),
      acceptedAtWarehouseQty: sum(receipts.map((r) => (r.result.status === "CONFERIDO" ? r.result.acceptedQty : 0))),
      rejectedAtSchoolQty: sum(lines.map((l) => l.rejectedAtSchoolQty)),
      lossBeforeSchoolQty: sum(lines.map((l) => l.lossBeforeSchoolQty)),
    };
    attendanceByUnit[unit] = attendanceRate(lines);
  }

  return {
    state,
    receiptsConferred,
    valuesCalculated,
    readyToClose: state === "PRONTO_PARA_FECHAR",
    counts,
    totalsByUnit,
    attendanceByUnit,
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

// ---------------------------------------------------------------- por escola

// "Entrega registrada" (conferência feita) é diferente de "pedido atendido"
// (sem falta). Nunca resumir os dois num único OK.
export type SchoolDeliveryState = "SEM_PEDIDO" | "PENDENTE_CONFERENCIA" | "ENTREGA_REGISTRADA" | "COM_ERROS";
export type SchoolAttendanceState = "SEM_PEDIDO" | "A_CONFERIR" | "ATENDIDO" | "ATENDIMENTO_PARCIAL" | "NAO_ATENDIDO";

export interface SchoolSummary {
  schoolId: string;
  delivery: SchoolDeliveryState;
  attendance: SchoolAttendanceState;
  linesWithShortage: number;
  linesWithExcess: number;
  shortagesOpen: number;
  shortagesClosedWithoutService: number;
  readyToClose: boolean;
}

export function summarizeSchools(lines: SchoolLineResult[]): SchoolSummary[] {
  const bySchool = new Map<string, SchoolLineResult[]>();
  for (const l of lines) bySchool.set(l.schoolId, [...(bySchool.get(l.schoolId) ?? []), l]);
  return [...bySchool.entries()].map(([schoolId, ls]) => {
    const withOrder = ls.filter((l) => l.receiptStatus !== "SEM_PEDIDO");
    let delivery: SchoolDeliveryState;
    if (withOrder.length === 0) delivery = "SEM_PEDIDO";
    else if (ls.some((l) => l.receiptStatus === "ERRO")) delivery = "COM_ERROS";
    else if (ls.some((l) => l.receiptStatus === "PENDENTE_CONFERENCIA")) delivery = "PENDENTE_CONFERENCIA";
    else delivery = "ENTREGA_REGISTRADA";

    let attendance: SchoolAttendanceState;
    if (delivery === "SEM_PEDIDO") attendance = "SEM_PEDIDO";
    else if (delivery !== "ENTREGA_REGISTRADA") attendance = "A_CONFERIR";
    else if (withOrder.every((l) => l.shortageQty === 0)) attendance = "ATENDIDO";
    else if (withOrder.every((l) => l.acceptedQty === 0)) attendance = "NAO_ATENDIDO";
    else attendance = "ATENDIMENTO_PARCIAL";

    return {
      schoolId,
      delivery,
      attendance,
      linesWithShortage: ls.filter((l) => l.shortageQty > 0).length,
      linesWithExcess: ls.filter((l) => l.excessQty > 0).length,
      shortagesOpen: ls.filter((l) => ["SEM_DECISAO", "EM_RESOLUCAO", "DECISAO_INCOERENTE"].includes(l.shortageStatus)).length,
      shortagesClosedWithoutService: ls.filter((l) => l.shortageStatus === "ENCERRADA_SEM_ATENDIMENTO").length,
      readyToClose: ls.every((l) => l.readyToClose),
    };
  });
}

// ---------------------------------------------------------------- prévia de fechamento

export interface ClosingPreview {
  state: CycleState;
  canClose: boolean;
  blockers: string[];
  // Arredondamento: cada linha é arredondada a centavos e o total é a soma das
  // linhas arredondadas — a soma do que aparece linha a linha bate com o total
  // em tela e em PDF.
  receivableTotal: number;
  payableTotal: number;
  calculatedResult: number;
  receivableLines: { schoolId: string; productId: string; acceptedQty: number; unit: Unit; price: number; value: number }[];
  payableLines: { producerId: string; productId: string; acceptedQty: number; unit: Unit; netPrice: number; value: number }[];
  closedShortages: { schoolId: string; productId: string; unit: Unit; qty: number; reason: string }[];
  totalsByUnit: CycleSummary["totalsByUnit"];
}

// Prévia mostrada antes de confirmar o fechamento (spec 008, RN-10): totais,
// rejeições/perdas, faltas encerradas, a cobrar e a pagar. Valores calculados,
// não quitação. Não fecha nada: quem fecha é uma ação deliberada.
export function closingPreview(input: CycleInput): ClosingPreview {
  const summary = summarizeCycle(input);
  const blockers: string[] = [];
  const c = summary.counts;
  if (summary.state === "AGUARDANDO_PEDIDO") blockers.push("Ciclo sem pedido e sem movimentação.");
  if (c.errors) blockers.push(`${c.errors} lançamento(s) com erro.`);
  if (c.schoolLinesPending) blockers.push(`${c.schoolLinesPending} item(ns) de escola sem conferência.`);
  if (c.warehousePending) blockers.push(`${c.warehousePending} recebimento(s) no galpão sem conferência.`);
  if (c.shortagesWithoutDecision) blockers.push(`${c.shortagesWithoutDecision} falta(s) sem decisão.`);
  if (c.shortagesInResolution) blockers.push(`${c.shortagesInResolution} falta(s) em resolução.`);
  if (c.incoherentDecisions) blockers.push(`${c.incoherentDecisions} decisão(ões) de falta incoerente(s) com os números atuais.`);

  const receivableLines: ClosingPreview["receivableLines"] = [];
  let missingSchoolPrice = 0;
  for (const l of summary.schoolLines) {
    if (!l.valueCalculable || l.acceptedQty === 0) continue;
    if (l.price === null) {
      missingSchoolPrice++;
      continue;
    }
    receivableLines.push({ schoolId: l.schoolId, productId: l.productId, acceptedQty: l.acceptedQty, unit: l.unit, price: l.price, value: schoolReceivable(l.acceptedQty, l.price) });
  }
  const payableLines: ClosingPreview["payableLines"] = [];
  let missingProducerPrice = 0;
  for (const r of summary.warehouseReceipts) {
    if (r.result.status !== "CONFERIDO" || r.result.acceptedQty === 0) continue;
    if (r.price === undefined || r.logisticsDeductionSnapshot === undefined) {
      missingProducerPrice++;
      continue;
    }
    payableLines.push({
      producerId: r.producerId,
      productId: r.productId,
      acceptedQty: r.result.acceptedQty,
      unit: r.unit ?? "kg",
      netPrice: round2(r.price - r.logisticsDeductionSnapshot),
      value: producerPayable(r.result.acceptedQty, r.price, r.logisticsDeductionSnapshot),
    });
  }
  if (missingSchoolPrice) blockers.push(`${missingSchoolPrice} item(ns) de escola sem preço congelado.`);
  if (missingProducerPrice) blockers.push(`${missingProducerPrice} recebimento(s) sem preço/desconto congelado.`);

  const receivableTotal = round2(receivableLines.reduce((a, l) => a + l.value, 0));
  const payableTotal = round2(payableLines.reduce((a, l) => a + l.value, 0));
  return {
    state: summary.state,
    canClose: summary.readyToClose && blockers.length === 0,
    blockers,
    receivableTotal,
    payableTotal,
    calculatedResult: round2(receivableTotal - payableTotal),
    receivableLines,
    payableLines,
    closedShortages: summary.schoolLines
      .filter((l) => l.shortageStatus === "ENCERRADA_SEM_ATENDIMENTO")
      .map((l) => {
        const decision = input.schoolLines.find((x) => x.schoolId === l.schoolId && x.productId === l.productId)?.shortageDecision;
        return { schoolId: l.schoolId, productId: l.productId, unit: l.unit, qty: l.shortageQty, reason: decision?.kind === "ENCERRADA_SEM_ATENDIMENTO" ? decision.reason : "" };
      }),
    totalsByUnit: summary.totalsByUnit,
  };
}
