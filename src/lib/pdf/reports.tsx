import { prisma } from "@/lib/prisma";
import { formatQty, formatQtyNumber, productUnit } from "@/lib/format";
import { getWeekFinancialSummary, getWarehouseDifferenceLines, getProducerPaymentLines } from "@/lib/weekSummary";
import { fmtMoneyPdf, fmtDatePdf, fmtDateTimePdf, CADASTRO_DISCLAIMER } from "./styles";
import { SimpleReportDocument, type ReportColumn } from "./SimpleReport";
import { SchoolRomaneiosDocument, type SchoolRomaneio } from "./SchoolRomaneiosDocument";
import { BalanceReportDocument } from "./BalanceReportDocument";
import type { ReportKey } from "./definitions";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { WeekStatus } from "@prisma/client";

export { REPORT_DEFINITIONS, isReportKey, type ReportKey } from "./definitions";

export interface ReportResult {
  fileName: string;
  element: ReactElement<DocumentProps>;
}

interface WeekMeta {
  id: string;
  number: number;
  startDate: Date;
  endDate: Date;
  status: WeekStatus;
}

function weekRangeLabel(week: WeekMeta): string {
  return `${fmtDatePdf(week.startDate)} – ${fmtDatePdf(week.endDate)}`;
}

export interface ReportOptions {
  // Romaneios: só uma escola (por código) e/ou 4 vias.
  schoolCode?: string;
  copies?: 1 | 4;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fileNameFor(week: WeekMeta, key: string, suffix = ""): string {
  return `semana-${week.number}-${isoDate(week.startDate)}-${key}${suffix}.pdf`;
}

async function buildPedidoEscolas(week: WeekMeta, issuedAt: string): Promise<ReportResult> {
  const orders = await prisma.schoolOrder.findMany({
    where: { weekId: week.id, orderedQty: { gt: 0 } },
    include: { school: true, product: true },
    orderBy: [{ school: { code: "asc" } }, { product: { name: "asc" } }],
  });
  const columns: ReportColumn[] = [
    { header: "Código", width: "12%" },
    { header: "Escola", width: "48%" },
    { header: "Produto", width: "25%" },
    { header: "Pedido", width: "15%", align: "right" },
  ];
  const rows = orders.map((o) => [o.school.code, o.school.name, o.product.name, formatQty(Number(o.orderedQty), o.product.slug)]);
  return {
    fileName: fileNameFor(week, "pedido-escolas"),
    element: (
      <SimpleReportDocument
        title="Pedido das Escolas"
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        columns={columns}
        rows={rows}
        emptyMessage="Nenhum pedido lançado nesta semana."
        footNote={CADASTRO_DISCLAIMER}
      />
    ),
  };
}

async function buildPedidoProdutores(week: WeekMeta, issuedAt: string): Promise<ReportResult> {
  const orders = await prisma.producerOrder.findMany({
    where: { weekId: week.id, orderedQty: { gt: 0 } },
    include: { producer: true, product: true },
    orderBy: [{ producer: { internalId: "asc" } }, { product: { name: "asc" } }],
  });
  const columns: ReportColumn[] = [
    { header: "Código", width: "12%" },
    { header: "Produtor", width: "48%" },
    { header: "Produto", width: "25%" },
    { header: "Pedido", width: "15%", align: "right" },
  ];
  const rows = orders.map((o) => [o.producer.internalId, o.producer.name, o.product.name, formatQty(Number(o.orderedQty), o.product.slug)]);
  return {
    fileName: fileNameFor(week, "pedido-produtores"),
    element: (
      <SimpleReportDocument
        title="Pedidos aos Produtores"
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        columns={columns}
        rows={rows}
        emptyMessage="Nenhum pedido lançado aos produtores nesta semana."
        footNote="Pedido é independente da entrega real — o pagamento é sempre calculado sobre a entrega, nunca sobre este pedido."
      />
    ),
  };
}

async function buildRomaneiosEscolas(week: WeekMeta, issuedAt: string, options: ReportOptions = {}): Promise<ReportResult> {
  const orders = await prisma.schoolOrder.findMany({
    where: { weekId: week.id, orderedQty: { gt: 0 }, ...(options.schoolCode ? { school: { code: options.schoolCode } } : {}) },
    include: { school: true, product: true },
    orderBy: { product: { name: "asc" } },
  });
  const returns = await prisma.schoolReturn.findMany({ where: { weekId: week.id }, include: { returnReason: true } });
  const returnByKey = new Map(returns.map((r) => [`${r.schoolId}:${r.productId}`, r]));

  const bySchool = new Map<string, SchoolRomaneio>();
  for (const o of orders) {
    const entry =
      bySchool.get(o.schoolId) ??
      ({
        code: o.school.code,
        name: o.school.name,
        neighborhood: o.school.neighborhood,
        address: o.school.address,
        phone: o.school.phone,
        lines: [],
      } satisfies SchoolRomaneio);
    const ret = returnByKey.get(`${o.schoolId}:${o.productId}`);
    entry.lines.push({
      productName: o.product.name,
      unit: productUnit(o.product.slug),
      orderedQtyLabel: formatQtyNumber(Number(o.orderedQty)),
      systemReturnLabel: ret && Number(ret.returnedQty) > 0 ? `${formatQty(Number(ret.returnedQty), o.product.slug)} (${ret.returnReason.code} · ${ret.returnReason.description})` : null,
    });
    bySchool.set(o.schoolId, entry);
  }
  const schools = [...bySchool.values()].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  const suffix = `${options.schoolCode ? `-escola-${options.schoolCode}` : ""}${options.copies === 4 ? "-4-vias" : ""}`;

  return {
    fileName: fileNameFor(week, "romaneios-escolas", suffix),
    element: (
      <SchoolRomaneiosDocument
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        schools={schools}
        copies={options.copies}
      />
    ),
  };
}

async function buildRecebimentoGalpao(week: WeekMeta, issuedAt: string): Promise<ReportResult> {
  const lines = await getProducerPaymentLines(week.id);
  const columns: ReportColumn[] = [
    { header: "Produtor", width: "28%" },
    { header: "Produto", width: "22%" },
    { header: "Entrega bruta", width: "15%", align: "right" },
    { header: "Rejeição/devolução", width: "15%", align: "right" },
    { header: "Aceito no galpão", width: "10%", align: "right" },
    { header: "A pagar", width: "10%", align: "right" },
  ];
  const rows = lines.map((l) => [
    l.producerName,
    l.productName,
    formatQty(l.deliveredQty, l.productSlug),
    formatQty(l.returnedQty, l.productSlug),
    formatQty(l.netQty, l.productSlug),
    fmtMoneyPdf(l.payment),
  ]);
  return {
    fileName: fileNameFor(week, "recebimento-galpao"),
    element: (
      <SimpleReportDocument
        title="Recebimento e Devoluções no Galpão"
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        columns={columns}
        rows={rows}
        emptyMessage="Nenhuma entrega de produtor registrada nesta semana."
        landscape
        footNote="A pagar = (entrega bruta - rejeição no galpão) × (preço - desconto de logística), congelados no lançamento. Rejeição ocorrida depois, na escola, não é descontada do produtor. Valor calculado, não quitado."
      />
    ),
  };
}

async function buildEntregasEscolas(week: WeekMeta, issuedAt: string): Promise<ReportResult> {
  const [deliveries, orderedSchoolIds] = await Promise.all([
    prisma.schoolDelivery.findMany({ where: { weekId: week.id }, include: { school: true } }),
    prisma.schoolOrder
      .findMany({ where: { weekId: week.id, orderedQty: { gt: 0 } }, select: { schoolId: true }, distinct: ["schoolId"] })
      .then((rows) => new Set(rows.map((r) => r.schoolId))),
  ]);
  const deliveredBySchool = new Map(deliveries.map((d) => [d.schoolId, d]));
  const allSchoolIds = new Set([...orderedSchoolIds, ...deliveredBySchool.keys()]);
  const schools = await prisma.school.findMany({ where: { id: { in: [...allSchoolIds] } } });
  const schoolById = new Map(schools.map((s) => [s.id, s]));

  const WEEKDAY_LABEL: Record<string, string> = { SEGUNDA: "Segunda-feira", TERCA: "Terça-feira", EXCEPCIONAL: "Data excepcional" };

  const rows = [...allSchoolIds]
    .map((schoolId) => {
      const school = schoolById.get(schoolId);
      if (!school) return null;
      const delivery = deliveredBySchool.get(schoolId);
      return [
        school.code,
        school.name,
        delivery ? WEEKDAY_LABEL[delivery.weekday] ?? delivery.weekday : "—",
        delivery ? fmtDatePdf(delivery.deliveredAt) : "—",
        delivery ? "Confirmada" : "Pendente",
      ];
    })
    .filter((r): r is string[] => r !== null)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const columns: ReportColumn[] = [
    { header: "Código", width: "12%" },
    { header: "Escola", width: "43%" },
    { header: "Dia", width: "18%" },
    { header: "Data", width: "12%" },
    { header: "Situação", width: "15%" },
  ];
  return {
    fileName: fileNameFor(week, "entregas-escolas"),
    element: (
      <SimpleReportDocument
        title="Entregas às Escolas"
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        columns={columns}
        rows={rows}
        emptyMessage="Nenhum pedido ou entrega registrada neste ciclo."
        notice="Modelo antigo: este documento confirma apenas o DIA em que a escola foi atendida. Ele NÃO comprova a quantidade recebida por produto — o sistema ainda não registra entrega por escola/produto (spec 008). A prova da quantidade é o romaneio assinado."
      />
    ),
  };
}

async function buildDiferenca(week: WeekMeta, issuedAt: string): Promise<ReportResult> {
  const lines = await getWarehouseDifferenceLines(week.id);
  const columns: ReportColumn[] = [
    { header: "Produto", width: "24%" },
    { header: "Pedido escolas", width: "16%", align: "right" },
    { header: "Entrega bruta", width: "16%", align: "right" },
    { header: "Devolução", width: "14%", align: "right" },
    { header: "Entrega líquida", width: "14%", align: "right" },
    { header: "Diferença", width: "8%", align: "right" },
    { header: "Status", width: "8%" },
  ];
  const rows = lines.map((l) => [
    l.productName,
    formatQty(l.orderedQty, l.productSlug),
    formatQty(l.deliveredQty, l.productSlug),
    formatQty(l.returnedQty, l.productSlug),
    formatQty(l.netDeliveredQty, l.productSlug),
    `${l.difference > 0 ? "+" : ""}${formatQty(l.difference, l.productSlug)}`,
    l.status,
  ]);
  return {
    fileName: fileNameFor(week, "diferenca"),
    element: (
      <SimpleReportDocument
        title="Relatório de Diferenças (Galpão × Pedido das Escolas)"
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        columns={columns}
        rows={rows}
        emptyMessage="Nenhum pedido ou entrega registrada nesta semana."
        landscape
        footNote="Comparação por produto entre o pedido das escolas e o que o galpão recebeu dos produtores. Não representa o estoque atual do galpão nem o quanto cada escola recebeu de fato."
      />
    ),
  };
}

async function buildBalanco(week: WeekMeta, issuedAt: string): Promise<ReportResult> {
  const summary = await getWeekFinancialSummary(week.id);
  const byProducer = new Map<string, { name: string; total: number }>();
  for (const l of summary.producerLines) {
    const cur = byProducer.get(l.producerId) ?? { name: l.producerName, total: 0 };
    cur.total += l.payment;
    byProducer.set(l.producerId, cur);
  }
  const COST_LABELS: Record<string, string> = {
    TRANSPORTE: "Transporte",
    MONTAGEM: "Montagem",
    ADMINISTRATIVO: "Administrativo",
    EMBALAGENS_MATERIAL_LIMPEZA: "Embalagens + Material de Limpeza",
    MATERIAL_ESCRITORIO: "Material de Escritório",
    IMPOSTOS: "Impostos",
    SERVICO_CONTABILIDADE: "Serviço de Contabilidade",
    AJUDA_CUSTO_CONSELHO: "Ajuda de Custo Conselho",
  };

  return {
    fileName: fileNameFor(week, "balanco"),
    element: (
      <BalanceReportDocument
        weekNumber={week.number}
        weekRange={weekRangeLabel(week)}
        weekStatus={week.status}
        issuedAt={issuedAt}
        treasuryTotalLabel={fmtMoneyPdf(summary.treasuryTotal)}
        producersTotalLabel={fmtMoneyPdf(summary.producersTotal)}
        grossMarginLabel={fmtMoneyPdf(summary.grossMargin)}
        totalCostsLabel={fmtMoneyPdf(summary.totalCosts)}
        balanceLabel={fmtMoneyPdf(summary.balance)}
        costRows={summary.costs.map((c) => ({ label: COST_LABELS[c.category] ?? c.category, amountLabel: fmtMoneyPdf(c.amount) }))}
        producerRows={[...byProducer.values()].map((p) => ({ name: p.name, amountLabel: fmtMoneyPdf(p.total) }))}
        reconciliationOk={summary.reconciliation.status === "OK"}
        reconciliationNote={
          summary.reconciliation.status === "OK"
            ? ""
            : `Divergência de ${fmtMoneyPdf(summary.reconciliation.difference)} entre a soma individual e o total geral.`
        }
      />
    ),
  };
}

const BUILDERS: Record<ReportKey, (week: WeekMeta, issuedAt: string, options?: ReportOptions) => Promise<ReportResult>> = {
  "pedido-escolas": buildPedidoEscolas,
  "pedido-produtores": buildPedidoProdutores,
  "romaneios-escolas": buildRomaneiosEscolas,
  "recebimento-galpao": buildRecebimentoGalpao,
  "entregas-escolas": buildEntregasEscolas,
  diferenca: buildDiferenca,
  balanco: buildBalanco,
};

export async function getWeekMeta(weekId: string): Promise<WeekMeta | null> {
  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) return null;
  return { id: week.id, number: week.number, startDate: week.startDate, endDate: week.endDate, status: week.status };
}

export async function buildReport(week: WeekMeta, key: ReportKey, options: ReportOptions = {}): Promise<ReportResult> {
  const issuedAt = fmtDateTimePdf(new Date());
  return BUILDERS[key](week, issuedAt, options);
}
