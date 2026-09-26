import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { WeekStatus } from "@prisma/client";
import type { CycleLedger } from "../domain/cycleLedger";
import {
  acceptedBalance,
  attendanceReport,
  differenceReport,
  eventRomaneios,
  fmt,
  schoolOrderRows,
  warehouseRows,
  type CycleCoreReportKey,
  type DocumentNames,
} from "../cycleCore/documents";
import { AcceptedBalanceDocument } from "./AcceptedBalanceDocument";
import { EventRomaneiosDocument } from "./EventRomaneiosDocument";
import { SimpleReportDocument, type ReportColumn } from "./SimpleReport";
import { CADASTRO_DISCLAIMER } from "./styles";

// Documentos do ciclo montados a partir do registro do núcleo (lógica
// corrigida). Mesmos tipos e nomes de arquivo dos documentos atuais; só a
// fonte muda (ver DOCUMENT_SOURCES). Hoje usados pela demonstração; quando a
// persistência existir, a rota da semana escolhe por metodologia.

export { CYCLE_CORE_REPORTS, isCycleCoreReportKey, type CycleCoreReportKey } from "../cycleCore/documents";

export interface CycleCoreMeta {
  cycleLabel: string;
  status: WeekStatus;
  issuedAt: string;
  // Início do nome dos arquivos, ex.: "semana-12-2026-09-27" ou "demonstracao".
  fileBase: string;
  // Prefixo do número dos romaneios, ex.: "S12".
  cycleCode: string;
  banner?: string;
  costs?: { label: string; amount: number }[];
}

export interface CycleCoreReportOptions {
  schoolId?: string;
  copies?: 1 | 4;
}

export interface CycleCoreReportResult {
  fileName: string;
  element: ReactElement<DocumentProps>;
}

function simple(
  meta: CycleCoreMeta,
  title: string,
  columns: ReportColumn[],
  rows: (string | number)[][],
  extra: { notice?: string; footNote?: string; landscape?: boolean; emptyMessage?: string; groupFirstColumn?: boolean },
) {
  return (
    <SimpleReportDocument
      title={title}
      weekNumber={0}
      weekRange=""
      weekStatus={meta.status}
      issuedAt={meta.issuedAt}
      columns={columns}
      rows={rows}
      cycleLabel={meta.cycleLabel}
      banner={meta.banner}
      {...extra}
    />
  );
}

export function buildCycleCoreReport(
  ledger: CycleLedger,
  names: DocumentNames,
  meta: CycleCoreMeta,
  key: CycleCoreReportKey,
  options: CycleCoreReportOptions = {},
): CycleCoreReportResult {
  const fileName = (suffix = "") => `${meta.fileBase}-${key}${suffix}.pdf`;

  switch (key) {
    case "pedido-escolas":
      return {
        fileName: fileName(),
        element: simple(
          meta,
          "Pedido das Escolas",
          [
            { header: "Escola", width: "55%" },
            { header: "Produto", width: "30%" },
            { header: "Pedido", width: "15%", align: "right" },
          ],
          schoolOrderRows(ledger, names),
          { footNote: CADASTRO_DISCLAIMER, emptyMessage: "Nenhum pedido neste ciclo.", groupFirstColumn: true },
        ),
      };

    case "romaneios-escolas": {
      const suffix = `${options.schoolId ? `-${options.schoolId}` : ""}${options.copies === 4 ? "-4-vias" : ""}`;
      return {
        fileName: fileName(suffix),
        element: (
          <EventRomaneiosDocument
            cycleLabel={meta.cycleLabel}
            status={meta.status}
            issuedAt={meta.issuedAt}
            banner={meta.banner}
            names={names}
            copies={options.copies}
            romaneios={eventRomaneios(ledger, names, meta.cycleCode, options.schoolId)}
          />
        ),
      };
    }

    case "recebimento-galpao":
      return {
        fileName: fileName(),
        element: simple(
          meta,
          "Recebimento e Rejeições no Galpão",
          [
            { header: "Produtor", width: "26%" },
            { header: "Produto", width: "18%" },
            { header: "Entregue (bruto)", width: "12%", align: "right" },
            { header: "Rejeitado", width: "10%", align: "right" },
            { header: "Aceito", width: "10%", align: "right" },
            { header: "Preço líquido", width: "12%", align: "right" },
            { header: "A pagar", width: "12%", align: "right" },
          ],
          warehouseRows(ledger, names),
          {
            notice: "Aceito no galpão = entrega bruta - rejeição no galpão. É a base do valor a pagar, com preço e desconto congelados. Rejeição na escola não altera este documento.",
            footNote: CADASTRO_DISCLAIMER,
            emptyMessage: "Nenhum recebimento no galpão neste ciclo.",
            groupFirstColumn: true,
          },
        ),
      };

    case "entregas-escolas": {
      const { rows, totals } = attendanceReport(ledger, names);
      const partial = (v: number, pending: boolean) => `${fmt(v)}${pending ? " (parcial)" : ""}`;
      const tableRows = [
        ...rows.map((r) => [
          names.schools[r.schoolId] ?? r.schoolId,
          names.products[r.productId] ?? r.productId,
          r.unit,
          fmt(r.orderedQty),
          partial(r.presentedQty, r.pending),
          r.complementCount ? String(r.complementCount) : "—",
          fmt(r.rejectedAtSchoolQty),
          fmt(r.lossBeforeSchoolQty),
          partial(r.acceptedQty, r.pending),
          r.pending ? "a conferir" : fmt(r.shortageQty),
          fmt(r.excessQty),
          r.decisionReason ? `${r.situation}: ${r.decisionReason}` : r.situation,
        ]),
        ...totals.map((t) => [
          `TOTAL (${t.unit})`,
          `atendimento ${t.attendancePercent === null ? "n/a" : `${fmt(t.attendancePercent)}%`}`,
          t.unit,
          fmt(t.orderedQty),
          "",
          "",
          fmt(t.rejectedAtSchoolQty),
          fmt(t.lossBeforeSchoolQty),
          fmt(t.acceptedQty),
          fmt(t.shortageQty),
          fmt(t.excessQty),
          `encerrada sem atendimento: ${fmt(t.shortageClosedQty)}${t.pendingLines ? `; ${t.pendingLines} linha(s) a conferir` : ""}`,
        ]),
      ];
      return {
        fileName: fileName(),
        element: simple(
          meta,
          "Entregas e Atendimento das Escolas",
          [
            { header: "Escola", width: "17%" },
            { header: "Produto", width: "11%" },
            { header: "Un.", width: "4%" },
            { header: "Pedido", width: "6%", align: "right" },
            { header: "Entregue", width: "8%", align: "right" },
            { header: "Compl.", width: "5%", align: "right" },
            { header: "Rej. escola", width: "6%", align: "right" },
            { header: "Perda antes", width: "6%", align: "right" },
            { header: "Aceito", width: "8%", align: "right" },
            { header: "Falta", width: "6%", align: "right" },
            { header: "Excedente", width: "6%", align: "right" },
            { header: "Situação", width: "17%" },
          ],
          tableRows,
          {
            landscape: true,
            notice:
              "Entregue = soma das entregas e complementos apresentados à escola; Aceito = entregue - rejeição da escola; Falta = pedido - aceito (nunca negativa). " +
              "\"(parcial)\" e \"a conferir\" indicam entrega ainda não conferida — vazio não é zero. Perda antes da escola é registrada à parte e não é rejeição da escola.",
            footNote:
              "Atendimento por unidade: cada linha conta no máximo o próprio pedido (o excedente de uma escola não cobre a falta de outra); demanda zero = n/a; com linhas a conferir, o percentual é parcial. " +
              "A falta total soma só linhas conferidas. kg e dz nunca são somados. " +
              CADASTRO_DISCLAIMER,
            emptyMessage: "Nenhum pedido neste ciclo.",
            groupFirstColumn: true,
          },
        ),
      };
    }

    case "diferenca":
      return {
        fileName: fileName(),
        element: simple(
          meta,
          "Relatório de Diferenças",
          [
            { header: "Produto", width: "18%" },
            { header: "Un.", width: "5%" },
            { header: "Pedido escolas", width: "11%", align: "right" },
            { header: "Aceito galpão", width: "11%", align: "right" },
            { header: "Entregue escolas", width: "11%", align: "right" },
            { header: "Perda antes", width: "10%", align: "right" },
            { header: "Saldo a conferir", width: "12%", align: "right" },
            { header: "Falta escolas", width: "11%", align: "right" },
            { header: "Excedente", width: "11%", align: "right" },
          ],
          differenceReport(ledger, names).map((r) => [
            names.products[r.productId] ?? r.productId,
            r.unit,
            fmt(r.orderedBySchools),
            fmt(r.acceptedAtWarehouse),
            fmt(r.presentedToSchools),
            fmt(r.lossBeforeSchool),
            fmt(r.balanceToCheck),
            r.pendingLines ? `${fmt(r.shortageAtSchools)} (+${r.pendingLines} a conferir)` : fmt(r.shortageAtSchools),
            fmt(r.excessAtSchools),
          ]),
          {
            landscape: true,
            notice:
              "Saldo a conferir = aceito no galpão - entregue às escolas - perda antes da escola. Não é estoque nem perda: pode ser produto ainda não entregue, sobra ou conferência pendente. " +
              "Falta das escolas = soma das faltas das linhas já conferidas (o excedente de uma escola não compensa a falta de outra); linhas a conferir aparecem à parte.",
            emptyMessage: "Nenhum produto neste ciclo.",
          },
        ),
      };

    case "balanco":
      return {
        fileName: fileName(),
        element: (
          <AcceptedBalanceDocument
            cycleLabel={meta.cycleLabel}
            status={meta.status}
            issuedAt={meta.issuedAt}
            banner={meta.banner}
            costs={meta.costs}
            balance={acceptedBalance(ledger, names)}
          />
        ),
      };
  }
}
