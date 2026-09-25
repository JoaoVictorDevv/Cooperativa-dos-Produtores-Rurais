import { Document, Page, Text, View } from "@react-pdf/renderer";
import { COOP_NAME, pdfStyles } from "./styles";
import type { WeekStatus } from "@prisma/client";

export interface ReportColumn {
  header: string;
  width: `${number}%`;
  align?: "left" | "right" | "center";
}

export interface SimpleReportProps {
  title: string;
  weekNumber: number;
  weekRange: string;
  weekStatus: WeekStatus;
  issuedAt: string;
  columns: ReportColumn[];
  rows: (string | number)[][];
  emptyMessage?: string;
  footNote?: string;
  landscape?: boolean;
}

// Documento tabular generico — cobre a maioria dos relatorios do plano
// §12 (pedido das escolas, pedidos aos produtores, resumo do galpao,
// entregas as escolas, diferencas). Sempre identifica a semana, a data
// de emissao, e avisa quando a semana ainda esta ABERTA (os valores
// podem mudar ate o fechamento).
export function SimpleReportDocument({
  title,
  weekNumber,
  weekRange,
  weekStatus,
  issuedAt,
  columns,
  rows,
  emptyMessage,
  footNote,
  landscape,
}: SimpleReportProps) {
  return (
    <Document>
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={pdfStyles.page}>
        <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
        <Text style={pdfStyles.sub}>
          Semana {weekNumber} · {weekRange}
        </Text>
        <Text style={pdfStyles.title}>{title}</Text>
        <Text style={pdfStyles.meta}>
          Emitido em {issuedAt} · Status da semana no momento da emissão: {weekStatus}
        </Text>
        {weekStatus === "ABERTA" && (
          <Text style={pdfStyles.openNotice}>
            Atenção: esta semana ainda está ABERTA. Os valores abaixo podem mudar até o fechamento.
          </Text>
        )}

        <View style={pdfStyles.headerRow}>
          {columns.map((c, i) => (
            <Text key={i} style={[pdfStyles.headerCell, { width: c.width, textAlign: c.align ?? "left" }]}>
              {c.header}
            </Text>
          ))}
        </View>
        {rows.map((r, ri) => (
          <View key={ri} style={pdfStyles.row} wrap={false}>
            {r.map((v, ci) => (
              <Text key={ci} style={[pdfStyles.cell, { width: columns[ci].width, textAlign: columns[ci].align ?? "left" }]}>
                {String(v)}
              </Text>
            ))}
          </View>
        ))}
        {rows.length === 0 && <Text style={{ fontSize: 9, marginTop: 10 }}>{emptyMessage ?? "Nenhum registro nesta semana."}</Text>}

        {footNote && <Text style={pdfStyles.footNote}>{footNote}</Text>}
      </Page>
    </Document>
  );
}
