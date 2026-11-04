import { Document, Page, Text, View } from "@react-pdf/renderer";
import { LEGACY_BILLING_NOTE, pdfStyles } from "./styles";
import { PageFrame } from "./SimpleReport";
import type { WeekStatus } from "@prisma/client";

export interface BalanceReportProps {
  weekNumber: number;
  weekRange: string;
  weekStatus: WeekStatus;
  issuedAt: string;
  treasuryTotalLabel: string;
  producersTotalLabel: string;
  grossMarginLabel: string;
  totalCostsLabel: string;
  balanceLabel: string;
  costRows: { label: string; amountLabel: string }[];
  producerRows: { name: string; amountLabel: string }[];
  reconciliationOk: boolean;
  reconciliationNote: string;
  roundingNote: string;
}

// Balanco Financeiro (plano §12): mesmo conteudo da tela /balanco,
// reaproveitando getWeekFinancialSummary — nunca recalcula nada aqui,
// so formata o que a tela ja usa.
export function BalanceReportDocument({
  weekNumber,
  weekRange,
  weekStatus,
  issuedAt,
  treasuryTotalLabel,
  producersTotalLabel,
  grossMarginLabel,
  totalCostsLabel,
  balanceLabel,
  costRows,
  producerRows,
  reconciliationOk,
  reconciliationNote,
  roundingNote,
}: BalanceReportProps) {
  return (
    <Document title={`Balanço Financeiro — Semana ${weekNumber}`}>
      <Page size="A4" style={[pdfStyles.page, { paddingBottom: 36 }]}>
        <PageFrame title="Balanço Financeiro" weekNumber={weekNumber} weekRange={weekRange} weekStatus={weekStatus} />
        <Text style={pdfStyles.title}>Balanço Financeiro</Text>
        <Text style={pdfStyles.meta}>
          Emitido em {issuedAt} · Status do ciclo na emissão: {weekStatus}
        </Text>
        {weekStatus === "ABERTA" && (
          <Text style={pdfStyles.openNotice}>
            Atenção: este ciclo ainda está ABERTO. Os valores abaixo podem mudar até o fechamento.
          </Text>
        )}
        <Text style={pdfStyles.methodNotice}>
          {LEGACY_BILLING_NOTE} {roundingNote}
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>A cobrar — Merenda Escolar (PMP)</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{treasuryTotalLabel}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>A pagar aos produtores</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{producersTotalLabel}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>Margem bruta</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{grossMarginLabel}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>Custos</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{totalCostsLabel}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>Resultado calculado</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{balanceLabel}</Text>
          </View>
        </View>

        <Text style={pdfStyles.sectionTitle}>Custos reais registrados neste ciclo</Text>
        <View style={pdfStyles.headerRow}>
          <Text style={[pdfStyles.headerCell, { width: "70%" }]}>Categoria</Text>
          <Text style={[pdfStyles.headerCell, { width: "30%" }]}>Valor</Text>
        </View>
        {costRows.map((c, i) => (
          <View key={i} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "70%" }]}>{c.label}</Text>
            <Text style={[pdfStyles.cell, { width: "30%" }]}>{c.amountLabel}</Text>
          </View>
        ))}

        <Text style={pdfStyles.sectionTitle}>Conferência — valor a pagar por produtor</Text>
        <View style={pdfStyles.headerRow}>
          <Text style={[pdfStyles.headerCell, { width: "70%" }]}>Produtor</Text>
          <Text style={[pdfStyles.headerCell, { width: "30%" }]}>Valor</Text>
        </View>
        {producerRows.map((p, i) => (
          <View key={i} style={pdfStyles.row} wrap={false}>
            <Text style={[pdfStyles.cell, { width: "70%" }]}>{p.name}</Text>
            <Text style={[pdfStyles.cell, { width: "30%" }]}>{p.amountLabel}</Text>
          </View>
        ))}
        {producerRows.length === 0 && <Text style={{ fontSize: 9, marginTop: 8 }}>Nenhuma entrega registrada ainda.</Text>}

        <Text style={pdfStyles.footNote}>
          {reconciliationOk ? "Conferência OK — soma individual bate com o total geral. " : ""}
          {reconciliationNote}
        </Text>
      </Page>
    </Document>
  );
}
