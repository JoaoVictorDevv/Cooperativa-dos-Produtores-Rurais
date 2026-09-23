import { Document, Page, Text, View } from "@react-pdf/renderer";
import { COOP_NAME, CADASTRO_DISCLAIMER, pdfStyles } from "./styles";
import type { WeekStatus } from "@prisma/client";

export interface SchoolRomaneioLine {
  productName: string;
  orderedQtyLabel: string;
  returnedQtyLabel: string;
  netQtyLabel: string;
  reasonLabel: string;
}

export interface SchoolRomaneio {
  code: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  phone: string | null;
  lines: SchoolRomaneioLine[];
}

export interface SchoolRomaneiosDocumentProps {
  weekNumber: number;
  weekRange: string;
  weekStatus: WeekStatus;
  issuedAt: string;
  schools: SchoolRomaneio[];
}

// Romaneios das escolas (plano §12): um romaneio por escola com pedido
// nesta semana, cada um em sua propria pagina — mesmo pra escolas que
// compartilham endereco fisico (nao ha fusao nenhuma, cada codigo de
// escola e um documento independente).
export function SchoolRomaneiosDocument({ weekNumber, weekRange, weekStatus, issuedAt, schools }: SchoolRomaneiosDocumentProps) {
  return (
    <Document>
      {schools.map((school) => (
        <Page key={school.code} size="A4" style={pdfStyles.page}>
          <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
          <Text style={pdfStyles.sub}>
            Controle de Entrega — Escola · Semana {weekNumber} ({weekRange})
          </Text>
          <Text style={pdfStyles.meta}>
            Emitido em {issuedAt} · Status da semana no momento da emissão: {weekStatus}
          </Text>
          {weekStatus === "ABERTA" && (
            <Text style={pdfStyles.openNotice}>
              Atenção: esta semana ainda está ABERTA. Os valores abaixo podem mudar até o fechamento.
            </Text>
          )}

          <View style={{ marginTop: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: 700 }}>{school.name}</Text>
            <Text style={{ fontSize: 8.5, color: "#444", marginTop: 2 }}>
              Código {school.code}
              {school.neighborhood ? ` · ${school.neighborhood}` : ""}
            </Text>
            {school.address && <Text style={{ fontSize: 8.5, color: "#444" }}>{school.address}</Text>}
            {school.phone && <Text style={{ fontSize: 8.5, color: "#444" }}>{school.phone}</Text>}
          </View>

          <View style={pdfStyles.headerRow}>
            <Text style={[pdfStyles.headerCell, { width: "34%" }]}>Produto</Text>
            <Text style={[pdfStyles.headerCell, { width: "16%" }]}>Pedido</Text>
            <Text style={[pdfStyles.headerCell, { width: "16%" }]}>Devolução</Text>
            <Text style={[pdfStyles.headerCell, { width: "24%" }]}>Motivo</Text>
            <Text style={[pdfStyles.headerCell, { width: "10%" }]}>Líquido</Text>
          </View>
          {school.lines.map((l, i) => (
            <View key={i} style={pdfStyles.row} wrap={false}>
              <Text style={[pdfStyles.cell, { width: "34%" }]}>{l.productName}</Text>
              <Text style={[pdfStyles.cell, { width: "16%" }]}>{l.orderedQtyLabel}</Text>
              <Text style={[pdfStyles.cell, { width: "16%" }]}>{l.returnedQtyLabel}</Text>
              <Text style={[pdfStyles.cell, { width: "24%" }]}>{l.reasonLabel}</Text>
              <Text style={[pdfStyles.cell, { width: "10%" }]}>{l.netQtyLabel}</Text>
            </View>
          ))}
          {school.lines.length === 0 && <Text style={{ fontSize: 9, marginTop: 8 }}>Nenhum pedido lançado para esta escola nesta semana.</Text>}

          <View style={{ marginTop: 30, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 8, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, width: "45%" }}>
              Assinatura de quem recebeu
            </Text>
            <Text style={{ fontSize: 8, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3, width: "25%" }}>Data</Text>
          </View>

          <Text style={pdfStyles.footNote}>{CADASTRO_DISCLAIMER}</Text>
        </Page>
      ))}
      {schools.length === 0 && (
        <Page size="A4" style={pdfStyles.page}>
          <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
          <Text style={pdfStyles.title}>Romaneios das Escolas</Text>
          <Text style={{ fontSize: 9, marginTop: 10 }}>Nenhuma escola com pedido lançado nesta semana.</Text>
        </Page>
      )}
    </Document>
  );
}
