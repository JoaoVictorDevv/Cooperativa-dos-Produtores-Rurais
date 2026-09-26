import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { WeekStatus } from "@prisma/client";
import { fmt, type DocumentNames, type EventRomaneio, type RomaneioLine } from "../cycleCore/documents";
import { ROMANEIO_VIAS } from "./SchoolRomaneiosDocument";
import { CADASTRO_DISCLAIMER, COOP_NAME, pdfStyles } from "./styles";

// Romaneios pela lógica corrigida (spec 004 RD-05, spec 008 RN-06): um
// documento para a entrega inicial de cada escola e um documento próprio para
// cada complemento. O inicial "previsto" sai com a conferência em branco; o
// "registrado" é cópia conforme o sistema. Um complemento nunca altera o
// documento da entrega inicial.

export interface EventRomaneiosProps {
  cycleLabel: string;
  status: WeekStatus;
  issuedAt: string;
  banner?: string;
  romaneios: EventRomaneio[];
  names: DocumentNames;
  copies?: 1 | 4;
}

const blank = { borderBottomWidth: 0.5, borderBottomColor: "#777", height: 11, marginHorizontal: 4 };

// "2026-09-28T09:40" (horário local digitado) → partes, sem conversão de fuso.
function splitLocal(value: string | null): { date: string; time: string } | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? { date: `${m[3]}/${m[2]}/${m[1]}`, time: `${m[4]}:${m[5]}` } : null;
}

function Cell({ value, width, right }: { value: string | number | null; width: string; right?: boolean }) {
  if (value === null) {
    return (
      <View style={{ width }}>
        <View style={blank} />
      </View>
    );
  }
  return <Text style={[pdfStyles.cell, { width, textAlign: right ? "right" : "left" }]}>{typeof value === "number" ? fmt(value) : value}</Text>;
}

const INITIAL_COLS = [
  { h: "Produto", w: "22%" },
  { h: "Un.", w: "6%" },
  { h: "Pedido", w: "10%", right: true },
  { h: "Entregue (bruto)", w: "12%", right: true },
  { h: "Rejeitado", w: "10%", right: true },
  { h: "Aceito", w: "10%", right: true },
  { h: "Motivo / observação", w: "30%" },
] as const;

const COMPLEMENT_COLS = [
  { h: "Produto", w: "18%" },
  { h: "Un.", w: "5%" },
  { h: "Pedido original", w: "10%", right: true },
  { h: "Aceito antes", w: "10%", right: true },
  { h: "Entregue agora", w: "10%", right: true },
  { h: "Rejeitado", w: "9%", right: true },
  { h: "Aceito agora", w: "10%", right: true },
  { h: "Origem / motivo", w: "28%" },
] as const;

function lineCells(r: EventRomaneio, l: RomaneioLine, names: DocumentNames) {
  const product = names.products[l.productId] ?? l.productId;
  if (r.kind === "INICIAL") {
    const c = INITIAL_COLS;
    return [
      <Cell key="p" value={product} width={c[0].w} />,
      <Cell key="u" value={l.unit} width={c[1].w} />,
      <Cell key="o" value={l.orderedQty} width={c[2].w} right />,
      <Cell key="b" value={l.presentedQty} width={c[3].w} right />,
      <Cell key="r" value={l.rejectedQty} width={c[4].w} right />,
      <Cell key="a" value={l.acceptedQty} width={c[5].w} right />,
      <Cell key="m" value={r.mode === "REGISTRADO" ? (l.reason ?? (l.presentedQty === null ? null : "—")) : null} width={c[6].w} />,
    ];
  }
  const c = COMPLEMENT_COLS;
  return [
    <Cell key="p" value={product} width={c[0].w} />,
    <Cell key="u" value={l.unit} width={c[1].w} />,
    <Cell key="o" value={l.orderedQty} width={c[2].w} right />,
    <Cell key="ab" value={l.acceptedBeforeQty} width={c[3].w} right />,
    <Cell key="b" value={l.presentedQty} width={c[4].w} right />,
    <Cell key="r" value={l.rejectedQty} width={c[5].w} right />,
    <Cell key="a" value={l.acceptedQty} width={c[6].w} right />,
    <Cell key="m" value={[l.source && `origem: ${l.source}`, l.reason].filter(Boolean).join("; ") || "—"} width={c[7].w} />,
  ];
}

function RomaneioPage({ r, via, props }: { r: EventRomaneio; via: string | null; props: EventRomaneiosProps }) {
  const cols = r.kind === "INICIAL" ? INITIAL_COLS : COMPLEMENT_COLS;
  const when = r.mode === "REGISTRADO" ? splitLocal(r.deliveredAt) : null;
  const title = r.kind === "INICIAL" ? "Romaneio de entrega — Escola" : "Romaneio de complemento — Escola";
  return (
    <Page size="A4" style={[pdfStyles.page, { paddingBottom: 36 }]}>
      {props.banner && (
        <Text fixed style={{ fontSize: 8, fontWeight: 700, color: "#7a5c0a", backgroundColor: "#F6EDD9", padding: 3, marginBottom: 4, textAlign: "center" }}>
          {props.banner}
        </Text>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>{title}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, fontWeight: 700 }}>Documento {r.docNumber}</Text>
          <Text style={{ fontSize: 8.5 }}>{props.cycleLabel}</Text>
          {via && <Text style={{ fontSize: 8.5, fontWeight: 700, marginTop: 2 }}>{via}</Text>}
        </View>
      </View>
      <Text style={[pdfStyles.meta, { marginTop: 4 }]}>
        Emitido em {props.issuedAt} · Ciclo {props.status === "ABERTA" ? "ABERTO" : "FECHADO"} na emissão ·{" "}
        {r.mode === "PREVISTO" ? "Conferência em branco — preencher na entrega" : "Cópia conforme registro no sistema; a via assinada é o comprovante"}
      </Text>

      <View style={{ borderWidth: 0.8, borderColor: "#333", padding: 6, marginBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{props.names.schools[r.schoolId] ?? r.schoolId}</Text>
        <Text style={{ fontSize: 8.5, marginTop: 2 }}>Código {r.schoolId}</Text>
      </View>

      {r.kind === "COMPLEMENTO" && (
        <Text style={pdfStyles.methodNotice}>
          Complemento no mesmo ciclo: nova entrega física, somada às anteriores. Não substitui nem altera o romaneio da entrega inicial ({r.docNumber.replace(/-C\d+$/, "")}).
        </Text>
      )}
      <Text style={{ fontSize: 8, marginBottom: 4 }}>Conferência na entrega: Entregue (bruto) - Rejeitado = Aceito. Pedido = solicitado pela prefeitura.</Text>

      <View style={pdfStyles.headerRow} fixed>
        {cols.map((c) => (
          <Text key={c.h} style={[pdfStyles.headerCell, { width: c.w, textAlign: "right" in c ? "right" : "left" }]}>
            {c.h}
          </Text>
        ))}
      </View>
      {r.lines.map((l, i) => (
        <View key={i} style={[pdfStyles.row, { paddingVertical: 5 }]} wrap={false}>
          {lineCells(r, l, props.names)}
        </View>
      ))}

      <View style={{ marginTop: 14 }} wrap={false}>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>
          {when ? `Data da entrega: ${when.date} | Horário da entrega: ${when.time}` : "Data da entrega: ____/____/______ | Horário da entrega: ____:____"}
        </Text>
        <Text style={{ fontSize: 7.5, color: "#555", marginTop: 2 }}>
          {when ? "Data e hora reais registradas para esta entrega." : "Data e hora reais da entrega na escola (não a de impressão ou de lançamento)."}
        </Text>
        <Text style={{ fontSize: 9, marginTop: 12 }}>Observações:</Text>
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#777", height: 16 }} />
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#777", height: 16 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 26 }}>
          <View style={{ width: "46%", borderTopWidth: 1, borderTopColor: "#000", paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>Nome legível de quem recebeu na escola{r.receivedBy ? ` (registrado: ${r.receivedBy})` : ""}</Text>
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

      <Text style={pdfStyles.footNote}>{CADASTRO_DISCLAIMER}</Text>
      <Text fixed style={{ position: "absolute", bottom: 14, right: 28, fontSize: 7.5, color: "#555" }}>
        {r.docNumber}
        {via ? ` · ${via}` : ""}
      </Text>
    </Page>
  );
}

export function EventRomaneiosDocument(props: EventRomaneiosProps) {
  const vias = props.copies === 4 ? [...ROMANEIO_VIAS] : [null];
  return (
    <Document title={`Romaneios — ${props.cycleLabel}`}>
      {props.romaneios.flatMap((r) => vias.map((via) => <RomaneioPage key={`${r.docNumber}-${via ?? "unica"}`} r={r} via={via} props={props} />))}
      {props.romaneios.length === 0 && (
        <Page size="A4" style={pdfStyles.page}>
          <Text style={pdfStyles.brand}>{COOP_NAME}</Text>
          <Text style={pdfStyles.title}>Romaneios das Escolas</Text>
          <Text style={{ fontSize: 9, marginTop: 10 }}>Nenhuma escola com pedido neste ciclo.</Text>
        </Page>
      )}
    </Document>
  );
}
