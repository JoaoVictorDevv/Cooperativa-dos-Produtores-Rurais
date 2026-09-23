import { Document, Page, Text, View } from "@react-pdf/renderer";
import { COOP_NAME, pdfStyles } from "./styles";
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
}: BalanceReportProps) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
        <Text style={pdfStyles.sub}>
          Semana {weekNumber} · {weekRange}
        </Text>
        <Text style={pdfStyles.title}>Balanço Financeiro</Text>
        <Text style={pdfStyles.meta}>
          Emitido em {issuedAt} · Status da semana no momento da emissão: {weekStatus}
        </Text>
        {weekStatus === "ABERTA" && (
          <Text style={pdfStyles.openNotice}>
            Atenção: esta semana ainda está ABERTA. Os valores abaixo podem mudar até o fechamento.
          </Text>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>Vendas Merenda Escolar (PMP)</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{treasuryTotalLabel}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: "#555" }}>Pago aos produtores</Text>
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
            <Text style={{ fontSize: 8, color: "#555" }}>Saldo da semana</Text>
            <Text style={{ fontSize: 12, fontWeight: 700 }}>{balanceLabel}</Text>
          </View>
        </View>

        <Text style={pdfStyles.sectionTitle}>Custos reais desta semana</Text>
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

        <Text style={pdfStyles.sectionTitle}>Conferência — valor pago por produtor</Text>
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
