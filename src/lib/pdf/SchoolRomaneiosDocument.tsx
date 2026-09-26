import { Document, Page, Text, View } from "@react-pdf/renderer";
import { COOP_NAME, CADASTRO_DISCLAIMER, pdfStyles } from "./styles";
import type { WeekStatus } from "@prisma/client";

export interface SchoolRomaneioLine {
  productName: string;
  unit: string;
  orderedQtyLabel: string;
  // Registro do modelo atual (devolução lançada no sistema), se houver.
  systemReturnLabel: string | null;
}

export interface SchoolRomaneio {
  code: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  phone: string | null;
  lines: SchoolRomaneioLine[];
}

export const ROMANEIO_VIAS = [
  "Via 1 — Escola",
  "Via 2 — Retorna com o caminhão",
  "Via 3 — Departamento de Merenda Escolar",
  "Via 4 — Departamento de Merenda Escolar",
] as const;

export interface SchoolRomaneiosDocumentProps {
  weekNumber: number;
  weekRange: string;
  weekStatus: WeekStatus;
  issuedAt: string;
  schools: SchoolRomaneio[];
  // 1 (padrão) ou 4 vias. As vias são só apresentação: o mesmo documento
  // impresso 4 vezes, sem criar entregas, cobranças ou históricos a mais.
  copies?: 1 | 4;
}

const COLS = [
  { h: "Produto", w: "24%" },
  { h: "Un.", w: "6%" },
  { h: "Pedido", w: "11%", right: true },
  { h: "Entregue (bruto)", w: "13%" },
  { h: "Rejeitado", w: "11%" },
  { h: "Aceito", w: "11%" },
  { h: "Motivo / observação", w: "24%" },
] as const;

const blank = { borderBottomWidth: 0.5, borderBottomColor: "#777", height: 11, marginHorizontal: 4 };

function Romaneio({ school, via, props }: { school: SchoolRomaneio; via: string | null; props: SchoolRomaneiosDocumentProps }) {
  const returns = school.lines.filter((l) => l.systemReturnLabel);
  const docNumber = `S${props.weekNumber}-${school.code}`;
  return (
    <Page size="A4" style={[pdfStyles.page, { paddingBottom: 36 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>Romaneio de entrega — Escola</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, fontWeight: 700 }}>Documento {docNumber}</Text>
          <Text style={{ fontSize: 8.5 }}>
            Semana {props.weekNumber} ({props.weekRange})
          </Text>
          {via && <Text style={{ fontSize: 8.5, fontWeight: 700, marginTop: 2 }}>{via}</Text>}
        </View>
      </View>
      <Text style={[pdfStyles.meta, { marginTop: 4 }]}>
        Emitido em {props.issuedAt} · Ciclo {props.weekStatus === "ABERTA" ? "ABERTO" : "FECHADO"} na emissão
      </Text>

      <View style={{ borderWidth: 0.8, borderColor: "#333", padding: 6, marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{school.name}</Text>
        <Text style={{ fontSize: 8.5, marginTop: 2 }}>
          Código {school.code}
          {school.neighborhood ? ` · Bairro ${school.neighborhood}` : ""}
        </Text>
        {school.address && <Text style={{ fontSize: 8.5 }}>{school.address}</Text>}
        {school.phone && <Text style={{ fontSize: 8.5 }}>Tel.: {school.phone}</Text>}
      </View>

      <Text style={{ fontSize: 8, marginBottom: 4 }}>Conferência na entrega: Entregue (bruto) - Rejeitado = Aceito. Pedido = solicitado pela prefeitura.</Text>

      <View style={pdfStyles.headerRow} fixed>
        {COLS.map((c) => (
          <Text key={c.h} style={[pdfStyles.headerCell, { width: c.w, textAlign: "right" in c ? "right" : "left" }]}>
            {c.h}
          </Text>
        ))}
      </View>
      {school.lines.map((l, i) => (
        <View key={i} style={[pdfStyles.row, { paddingVertical: 5 }]} wrap={false}>
          <Text style={[pdfStyles.cell, { width: COLS[0].w }]}>{l.productName}</Text>
          <Text style={[pdfStyles.cell, { width: COLS[1].w }]}>{l.unit}</Text>
          <Text style={[pdfStyles.cell, { width: COLS[2].w, textAlign: "right" }]}>{l.orderedQtyLabel}</Text>
          <View style={{ width: COLS[3].w }}>
            <View style={blank} />
          </View>
          <View style={{ width: COLS[4].w }}>
            <View style={blank} />
          </View>
          <View style={{ width: COLS[5].w }}>
            <View style={blank} />
          </View>
          <View style={{ width: COLS[6].w }}>
            <View style={blank} />
          </View>
        </View>
      ))}
      {school.lines.length === 0 && <Text style={{ fontSize: 9, marginTop: 8 }}>Nenhum pedido lançado para esta escola neste ciclo.</Text>}

      <View style={{ marginTop: 14 }} wrap={false}>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>Data da entrega: ____/____/______ | Horário da entrega: ____:____</Text>
        <Text style={{ fontSize: 7.5, color: "#555", marginTop: 2 }}>Data e hora reais da entrega na escola (não a de impressão ou de lançamento).</Text>
        <Text style={{ fontSize: 9, marginTop: 12 }}>Observações:</Text>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#777", height: 16 }} />
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#777", height: 16 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 26 }}>
          <View style={{ width: "46%", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>Nome legível de quem recebeu na escola</Text>
          </View>
          <View style={{ width: "46%", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>Assinatura de quem recebeu na escola</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 22 }}>
          <View style={{ width: "46%", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>Entregue por (cooperativa)</Text>
          </View>
          <View style={{ width: "46%", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>Assinatura</Text>
          </View>
        </View>
      </View>

      {returns.length > 0 && (
        <View style={{ marginTop: 12 }} wrap={false}>
          <Text style={{ fontSize: 8, fontWeight: 700 }}>Registros já lançados no sistema (modelo atual — devolução):</Text>
          {returns.map((l, i) => (
            <Text key={i} style={{ fontSize: 8 }}>
              {l.productName}: {l.systemReturnLabel}
            </Text>
          ))}
        </View>
      )}

      <Text style={pdfStyles.footNote}>
        Complementos/reposições no mesmo ciclo usam romaneio próprio, sem alterar este documento. {CADASTRO_DISCLAIMER}
      </Text>
      <Text fixed style={{ position: "absolute", bottom: 14, right: 28, fontSize: 7.5, color: "#555" }}>
        {docNumber}
        {via ? ` · ${via}` : ""}
      </Text>
    </Page>
  );
}

// Romaneio individual por escola (um documento por código, mesmo para escolas
// no mesmo endereço). Em 4 vias, cada escola sai 4 vezes seguidas, com o
// destino de cada via identificado.
export function SchoolRomaneiosDocument(props: SchoolRomaneiosDocumentProps) {
  const vias = props.copies === 4 ? [...ROMANEIO_VIAS] : [null];
  return (
    <Document title={`Romaneios — Semana ${props.weekNumber}`}>
      {props.schools.flatMap((school) => vias.map((via) => <Romaneio key={`${school.code}-${via ?? "unica"}`} school={school} via={via} props={props} />))}
      {props.schools.length === 0 && (
        <Page size="A4" style={pdfStyles.page}>
          <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
          <Text style={pdfStyles.title}>Romaneios das Escolas</Text>
          <Text style={{ fontSize: 9, marginTop: 10 }}>Nenhuma escola com pedido lançado neste ciclo.</Text>
        </Page>
      )}
    </Document>
  );
}
