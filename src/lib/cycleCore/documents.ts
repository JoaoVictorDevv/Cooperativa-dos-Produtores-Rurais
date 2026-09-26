// Conteúdo dos documentos do ciclo pela lógica corrigida (spec 004 × spec 008,
// prompt v2 §9, §10, §13, §14). Funções puras: recebem o registro do ciclo
// (CycleLedger) e devolvem linhas prontas para PDF ou tela. Hoje só a
// demonstração as usa; os ciclos reais continuam nos documentos do modelo
// atual até existir a persistência (docs/propostas-pendentes.md §9 e §10).

import { round2 } from "../calc";
import { attendanceRate, evaluateSchoolLine, summarizeCycle, type SchoolLineResult, type Unit } from "../domain/cycle";
import { cycleInput, ledgerClosingPreview, schoolLineInputs, type CycleLedger, type DeliveryEvent, type LedgerClosingPreview, type SupplySource } from "../domain/cycleLedger";

export interface DocumentNames {
  schools: Record<string, string>;
  products: Record<string, string>;
  producers: Record<string, string>;
}

// ---------------------------------------------------------------- metodologia × documentos

export type BillingMethodology = "LEGADO_PEDIDO_MENOS_DEVOLUCAO" | "ACEITE_ESCOLAR";
export type DocumentKey = "pedido-escolas" | "pedido-produtores" | "romaneios-escolas" | "recebimento-galpao" | "entregas-escolas" | "diferenca" | "balanco";
// ATUAL = builders de src/lib/pdf/reports.tsx (tabelas atuais).
// NUCLEO = builders do registro do ciclo (este arquivo).
export type DocumentSource = "ATUAL" | "NUCLEO";

// Os sete tipos de documento continuam os mesmos; muda a fonte do conteúdo.
// Pedido aos produtores não muda de fonte: a divisão e os pedidos continuam
// nas tabelas atuais.
export const DOCUMENT_SOURCES: Record<BillingMethodology, Record<DocumentKey, DocumentSource>> = {
  LEGADO_PEDIDO_MENOS_DEVOLUCAO: {
    "pedido-escolas": "ATUAL",
    "pedido-produtores": "ATUAL",
    "romaneios-escolas": "ATUAL",
    "recebimento-galpao": "ATUAL",
    "entregas-escolas": "ATUAL",
    diferenca: "ATUAL",
    balanco: "ATUAL",
  },
  ACEITE_ESCOLAR: {
    "pedido-escolas": "NUCLEO",
    "pedido-produtores": "ATUAL",
    "romaneios-escolas": "NUCLEO",
    "recebimento-galpao": "NUCLEO",
    "entregas-escolas": "NUCLEO",
    diferenca: "NUCLEO",
    balanco: "NUCLEO",
  },
};

// Documentos que o núcleo sabe montar (lista leve, sem a biblioteca de PDF).
export type CycleCoreReportKey = Exclude<DocumentKey, "pedido-produtores">;

export const CYCLE_CORE_REPORTS: { key: CycleCoreReportKey; label: string }[] = [
  { key: "pedido-escolas", label: "Pedido das Escolas" },
  { key: "romaneios-escolas", label: "Romaneios das Escolas (inicial e complementos)" },
  { key: "recebimento-galpao", label: "Recebimento e Rejeições no Galpão" },
  { key: "entregas-escolas", label: "Entregas e Atendimento das Escolas" },
  { key: "diferenca", label: "Relatório de Diferenças" },
  { key: "balanco", label: "Balanço Financeiro (aceito na escola)" },
];

export function isCycleCoreReportKey(value: string): value is CycleCoreReportKey {
  return CYCLE_CORE_REPORTS.some((r) => r.key === value);
}

// Hoje nenhum ciclo real tem entrega por escola/produto registrada: todos
// usam a metodologia antiga. Quando a persistência existir, o ciclo passará a
// informar a própria metodologia (escolhida explicitamente, sem recalcular o
// passado — spec 008, "Transição do histórico").
export function methodologyOfRealCycle(): BillingMethodology {
  return "LEGADO_PEDIDO_MENOS_DEVOLUCAO";
}

// ---------------------------------------------------------------- utilidades

const name = (map: Record<string, string>, id: string) => map[id] ?? id;
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
const byName = (names: Record<string, string>) => (a: string, b: string) => name(names, a).localeCompare(name(names, b), "pt-BR");

export function sourceText(source: SupplySource | null, names: DocumentNames): string {
  if (!source) return "não informado";
  return source.type === "SALDO_GALPAO" ? "saldo do galpão" : name(names.producers, source.producerId);
}

// Situação de uma linha escola × produto em texto, sem um único "OK" para
// entrega registrada e pedido atendido (RN-16).
export function lineSituation(line: SchoolLineResult): string {
  if (line.receiptStatus === "ERRO") return "Com erro";
  if (line.receiptStatus === "PENDENTE_CONFERENCIA") return "Pendente de conferência";
  const shortage: Record<string, string> = {
    SEM_DECISAO: "Falta sem decisão",
    EM_RESOLUCAO: "Falta em resolução",
    ENCERRADA_SEM_ATENDIMENTO: "Falta encerrada sem atendimento",
    DECISAO_INCOERENTE: "Decisão de falta incoerente",
  };
  if (shortage[line.shortageStatus]) return shortage[line.shortageStatus];
  if (line.excessQty > 0) return "Atendido com excedente";
  return "Atendido";
}

function orderedLines(ledger: CycleLedger, names: DocumentNames): SchoolLineResult[] {
  return schoolLineInputs(ledger)
    .map(evaluateSchoolLine)
    .filter((l) => l.receiptStatus !== "SEM_PEDIDO")
    .sort((a, b) => byName(names.schools)(a.schoolId, b.schoolId) || byName(names.products)(a.productId, b.productId));
}

// ---------------------------------------------------------------- pedido das escolas

export function schoolOrderRows(ledger: CycleLedger, names: DocumentNames): string[][] {
  return ledger.orders
    .filter((o) => o.orderedQty > 0)
    .sort((a, b) => byName(names.schools)(a.schoolId, b.schoolId) || byName(names.products)(a.productId, b.productId))
    .map((o) => [name(names.schools, o.schoolId), name(names.products, o.productId), `${fmt(o.orderedQty)} ${o.unit}`]);
}

// ---------------------------------------------------------------- entregas e atendimento

export interface AttendanceRow {
  schoolId: string;
  productId: string;
  unit: Unit;
  orderedQty: number;
  // Soma do entregue nos eventos conferidos. Com `pending`, é parcial.
  presentedQty: number;
  complementCount: number;
  rejectedAtSchoolQty: number;
  lossBeforeSchoolQty: number;
  acceptedQty: number;
  shortageQty: number;
  excessQty: number;
  pending: boolean;
  situation: string;
  decisionReason: string | null;
}

export interface AttendanceTotals {
  unit: Unit;
  orderedQty: number;
  acceptedQty: number;
  // Só linhas conferidas (falta de linha pendente ainda não é falta confirmada).
  shortageQty: number;
  pendingLines: number;
  shortageClosedQty: number;
  excessQty: number;
  rejectedAtSchoolQty: number;
  lossBeforeSchoolQty: number;
  // null = demanda zero (não aplicável). Base: cada linha conta no máximo o próprio pedido.
  attendancePercent: number | null;
}

export function attendanceReport(ledger: CycleLedger, names: DocumentNames): { rows: AttendanceRow[]; totals: AttendanceTotals[] } {
  const lines = orderedLines(ledger, names);
  const rows = lines.map((l) => {
    const decision = ledger.decisions.find((d) => d.schoolId === l.schoolId && d.productId === l.productId);
    return {
      schoolId: l.schoolId,
      productId: l.productId,
      unit: l.unit,
      orderedQty: l.orderedQty,
      presentedQty: l.presentedQty,
      complementCount: ledger.events.filter((e) => e.schoolId === l.schoolId && e.productId === l.productId && e.kind === "COMPLEMENTO").length,
      rejectedAtSchoolQty: l.rejectedAtSchoolQty,
      lossBeforeSchoolQty: l.lossBeforeSchoolQty,
      acceptedQty: l.acceptedQty,
      shortageQty: l.shortageQty,
      excessQty: l.excessQty,
      pending: l.receiptStatus === "PENDENTE_CONFERENCIA",
      situation: lineSituation(l),
      decisionReason: decision?.reason || null,
    };
  });
  const units = [...new Set(lines.map((l) => l.unit))].sort();
  const totals = units.map((unit) => {
    const ls = lines.filter((l) => l.unit === unit);
    return {
      unit,
      orderedQty: sum(ls.map((l) => l.orderedQty)),
      acceptedQty: sum(ls.map((l) => l.acceptedQty)),
      shortageQty: sum(ls.filter((l) => l.receiptStatus === "CONFERIDO").map((l) => l.shortageQty)),
      pendingLines: ls.filter((l) => l.receiptStatus === "PENDENTE_CONFERENCIA").length,
      shortageClosedQty: sum(ls.filter((l) => l.shortageStatus === "ENCERRADA_SEM_ATENDIMENTO").map((l) => l.shortageQty)),
      excessQty: sum(ls.map((l) => l.excessQty)),
      rejectedAtSchoolQty: sum(ls.map((l) => l.rejectedAtSchoolQty)),
      lossBeforeSchoolQty: sum(ls.map((l) => l.lossBeforeSchoolQty)),
      attendancePercent: attendanceRate(ls),
    };
  });
  return { rows, totals };
}

// ---------------------------------------------------------------- romaneios

export interface RomaneioLine {
  productId: string;
  unit: Unit;
  orderedQty: number;
  // Só nos complementos: aceito antes deste complemento (entrega inicial e complementos anteriores).
  acceptedBeforeQty: number | null;
  // null = ainda não registrado: o PDF deixa o campo em branco para preencher na entrega.
  presentedQty: number | null;
  rejectedQty: number | null;
  acceptedQty: number | null;
  reason: string | null;
  source: string | null;
}

export interface EventRomaneio {
  docNumber: string;
  kind: "INICIAL" | "COMPLEMENTO";
  schoolId: string;
  // INICIAL: "PREVISTO" (conferência em branco) ou "REGISTRADO" (cópia conforme registro).
  mode: "PREVISTO" | "REGISTRADO";
  deliveredAt: string | null;
  receivedBy: string | null;
  lines: RomaneioLine[];
}

function acceptedOf(e: DeliveryEvent): number {
  return e.presentedQty === null ? 0 : round2(e.presentedQty - e.rejectedQty);
}

function reasonOf(e: DeliveryEvent): string | null {
  const parts = [e.rejectionReason && `rejeição: ${e.rejectionReason}`, e.lossBeforeSchoolQty > 0 && `perda antes da escola ${fmt(e.lossBeforeSchoolQty)}${e.lossReason ? ` (${e.lossReason})` : ""}`].filter(Boolean);
  return parts.length ? parts.join("; ") : null;
}

// Um romaneio da entrega inicial por escola (todas as linhas com pedido) e um
// romaneio próprio para cada complemento — agrupando os complementos da mesma
// escola com a mesma data/hora real de entrega. O romaneio inicial nunca
// absorve o complemento: cada documento mostra só a própria entrega.
export function eventRomaneios(ledger: CycleLedger, names: DocumentNames, cycleCode: string, schoolId?: string): EventRomaneio[] {
  const schools = [...new Set(ledger.orders.filter((o) => o.orderedQty > 0).map((o) => o.schoolId))]
    .filter((s) => !schoolId || s === schoolId)
    .sort(byName(names.schools));
  const result: EventRomaneio[] = [];
  for (const s of schools) {
    const orders = ledger.orders.filter((o) => o.schoolId === s && o.orderedQty > 0).sort((a, b) => byName(names.products)(a.productId, b.productId));
    const initials = new Map(ledger.events.filter((e) => e.schoolId === s && e.kind === "INICIAL").map((e) => [e.productId, e]));
    const registered = orders.some((o) => initials.get(o.productId)?.presentedQty != null);
    const firstInitial = [...initials.values()][0];
    result.push({
      docNumber: `${cycleCode}-${s}`,
      kind: "INICIAL",
      schoolId: s,
      mode: registered ? "REGISTRADO" : "PREVISTO",
      deliveredAt: registered ? (firstInitial?.deliveredAt ?? null) : null,
      receivedBy: registered ? (firstInitial?.receivedBy ?? null) : null,
      lines: orders.map((o) => {
        const e = initials.get(o.productId);
        const has = registered && e && e.presentedQty !== null;
        return {
          productId: o.productId,
          unit: o.unit,
          orderedQty: o.orderedQty,
          acceptedBeforeQty: null,
          presentedQty: has ? e.presentedQty : null,
          rejectedQty: has ? e.rejectedQty : null,
          acceptedQty: has ? acceptedOf(e) : null,
          reason: has ? reasonOf(e) : null,
          source: has ? sourceText(e.source, names) : null,
        };
      }),
    });

    const complements = ledger.events.filter((e) => e.schoolId === s && e.kind === "COMPLEMENTO");
    const groups: DeliveryEvent[][] = [];
    for (const e of complements) {
      const group = e.deliveredAt ? groups.find((g) => g[0].deliveredAt === e.deliveredAt) : undefined;
      if (group) group.push(e);
      else groups.push([e]);
    }
    groups.forEach((group, gi) => {
      result.push({
        docNumber: `${cycleCode}-${s}-C${gi + 1}`,
        kind: "COMPLEMENTO",
        schoolId: s,
        mode: "REGISTRADO",
        deliveredAt: group[0].deliveredAt,
        receivedBy: group.find((e) => e.receivedBy)?.receivedBy ?? null,
        lines: group.map((e) => {
          const order = ledger.orders.find((o) => o.schoolId === s && o.productId === e.productId);
          const earlier = ledger.events.filter((x) => x.schoolId === s && x.productId === e.productId && ledger.events.indexOf(x) < ledger.events.indexOf(e));
          return {
            productId: e.productId,
            unit: order?.unit ?? "kg",
            orderedQty: order?.orderedQty ?? 0,
            acceptedBeforeQty: sum(earlier.map(acceptedOf)),
            presentedQty: e.presentedQty,
            rejectedQty: e.rejectedQty,
            acceptedQty: acceptedOf(e),
            reason: reasonOf(e),
            source: sourceText(e.source, names),
          };
        }),
      });
    });
  }
  return result;
}

// ---------------------------------------------------------------- galpão

export function warehouseRows(ledger: CycleLedger, names: DocumentNames): string[][] {
  return [...ledger.warehouseReceipts]
    .sort((a, b) => byName(names.producers)(a.producerId, b.producerId) || byName(names.products)(a.productId, b.productId))
    .map((r) => {
      const unit = r.unit ?? "kg";
      if (r.grossQty === null) return [name(names.producers, r.producerId), name(names.products, r.productId), "não conferido", "—", "—", "—", "—"];
      const accepted = round2(r.grossQty - r.rejectedQty);
      const hasPrice = r.price !== undefined && r.logisticsDeductionSnapshot !== undefined;
      const net = hasPrice ? round2(r.price! - r.logisticsDeductionSnapshot!) : null;
      return [
        name(names.producers, r.producerId),
        name(names.products, r.productId),
        `${fmt(r.grossQty)} ${unit}`,
        fmt(r.rejectedQty),
        fmt(accepted),
        net === null ? "sem preço congelado" : money(net),
        net === null ? "—" : money(round2(accepted * net)),
      ];
    });
}

// ---------------------------------------------------------------- diferenças

export interface DifferenceRow {
  productId: string;
  unit: Unit;
  orderedBySchools: number;
  acceptedAtWarehouse: number;
  presentedToSchools: number;
  lossBeforeSchool: number;
  // aceito no galpão − apresentado às escolas − perda antes da escola.
  // Não é estoque nem perda: é saldo a conferir.
  balanceToCheck: number;
  // Só linhas conferidas; pendingLines = linhas ainda a conferir.
  shortageAtSchools: number;
  pendingLines: number;
  excessAtSchools: number;
}

export function differenceReport(ledger: CycleLedger, names: DocumentNames): DifferenceRow[] {
  const lines = schoolLineInputs(ledger).map(evaluateSchoolLine);
  const products = [...new Set([...ledger.orders.map((o) => o.productId), ...ledger.warehouseReceipts.map((r) => r.productId)])].sort(byName(names.products));
  return products.map((productId) => {
    const ls = lines.filter((l) => l.productId === productId);
    const receipts = ledger.warehouseReceipts.filter((r) => r.productId === productId && r.grossQty !== null);
    const acceptedAtWarehouse = sum(receipts.map((r) => r.grossQty! - r.rejectedQty));
    const presented = sum(ls.map((l) => l.presentedQty));
    const loss = sum(ls.map((l) => l.lossBeforeSchoolQty));
    return {
      productId,
      unit: ls[0]?.unit ?? ledger.warehouseReceipts.find((r) => r.productId === productId)?.unit ?? "kg",
      orderedBySchools: sum(ls.map((l) => l.orderedQty)),
      acceptedAtWarehouse,
      presentedToSchools: presented,
      lossBeforeSchool: loss,
      balanceToCheck: round2(acceptedAtWarehouse - presented - loss),
      shortageAtSchools: sum(ls.filter((l) => l.receiptStatus === "CONFERIDO").map((l) => l.shortageQty)),
      pendingLines: ls.filter((l) => l.receiptStatus === "PENDENTE_CONFERENCIA").length,
      excessAtSchools: sum(ls.map((l) => l.excessQty)),
    };
  });
}

// ---------------------------------------------------------------- balanço pelo aceito

export interface AcceptedBalance {
  preview: LedgerClosingPreview;
  indicators: { receiptsConferred: boolean; valuesCalculated: boolean; readyToClose: boolean };
  receivableRows: string[][];
  payableRows: string[][];
  closedShortageRows: string[][];
}

export function acceptedBalance(ledger: CycleLedger, names: DocumentNames): AcceptedBalance {
  const preview = ledgerClosingPreview(ledger);
  const summary = summarizeCycle(cycleInput(ledger));
  return {
    preview,
    indicators: { receiptsConferred: summary.receiptsConferred, valuesCalculated: summary.valuesCalculated, readyToClose: preview.canClose },
    receivableRows: preview.receivableLines
      .slice()
      .sort((a, b) => byName(names.schools)(a.schoolId, b.schoolId) || byName(names.products)(a.productId, b.productId))
      .map((l) => [name(names.schools, l.schoolId), name(names.products, l.productId), `${fmt(l.acceptedQty)} ${l.unit}`, money(l.price), money(l.value)]),
    payableRows: preview.payableLines
      .slice()
      .sort((a, b) => byName(names.producers)(a.producerId, b.producerId) || byName(names.products)(a.productId, b.productId))
      .map((l) => [name(names.producers, l.producerId), name(names.products, l.productId), `${fmt(l.acceptedQty)} ${l.unit}`, money(l.netPrice), money(l.value)]),
    closedShortageRows: preview.closedShortages.map((s) => [name(names.schools, s.schoolId), name(names.products, s.productId), `${fmt(s.qty)} ${s.unit}`, s.reason]),
  };
}

// ---------------------------------------------------------------- formatação

export function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

export function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
