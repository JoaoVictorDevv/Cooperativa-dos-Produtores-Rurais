import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { WeekStatus } from "@prisma/client";
import { money, type AcceptedBalance } from "../cycleCore/documents";
import { PageFrame, TableHeader, groupRows, paginate, type ReportColumn } from "./SimpleReport";
import { pdfStyles } from "./styles";

// Balanço pela lógica corrigida (spec 008 RN-04, RN-10, CA-008.14): a cobrar =
// aceito na escola × preço congelado; a pagar = aceito no galpão × (preço −
// desconto) congelados. Os três indicadores aparecem separados e os motivos de
// bloqueio ficam visíveis. Valores calculados, não quitação.

export interface AcceptedBalanceProps {
  title?: string;
  cycleLabel: string;
  status: WeekStatus;
  issuedAt: string;
  banner?: string;
  balance: AcceptedBalance;
  // Custos reais registrados (WeeklyCost). Sem eles, o documento diz que não foram incluídos.
  costs?: { label: string; amount: number }[];
}

const RECEIVABLE: ReportColumn[] = [
  { header: "Escola", width: "38%" },
  { header: "Produto", width: "22%" },
  { header: "Aceito na escola", width: "14%", align: "right" },
  { header: "Preço", width: "12%", align: "right" },
  { header: "A cobrar", width: "14%", align: "right" },
];
const PAYABLE: ReportColumn[] = [
  { header: "Produtor", width: "38%" },
  { header: "Produto", width: "22%" },
  { header: "Aceito no galpão", width: "14%", align: "right" },
  { header: "Preço líquido", width: "12%", align: "right" },
  { header: "A pagar", width: "14%", align: "right" },
];
const SHORTAGES: ReportColumn[] = [
  { header: "Escola", width: "34%" },
  { header: "Produto", width: "20%" },
  { header: "Falta encerrada", width: "14%", align: "right" },
  { header: "Motivo", width: "32%" },
];

function Rows({ columns, rows }: { columns: ReportColumn[]; rows: string[][] }) {
  return (
    <>
      <TableHeader columns={columns} />
      {groupRows(rows).map((r, ri) => (
        <View key={ri} style={pdfStyles.row}>
          {r.map((v, ci) => (
            <Text key={ci} style={[pdfStyles.cell, { width: columns[ci].width, textAlign: columns[ci].align ?? "left" }]}>
              {v}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

export function AcceptedBalanceDocument(props: AcceptedBalanceProps) {
  const title = props.title ?? "Balanço Financeiro (aceito na escola)";
  const { preview, indicators } = props.balance;
  const totalCosts = props.costs?.reduce((a, c) => a + c.amount, 0) ?? 0;
  const frame = <PageFrame title={title} weekNumber={0} weekRange="" weekStatus={props.status} cycleLabel={props.cycleLabel} banner={props.banner} />;
  const sections: { heading: string; columns: ReportColumn[]; rows: string[][]; empty: string }[] = [
    { heading: "A cobrar da prefeitura — por escola e produto", columns: RECEIVABLE, rows: props.balance.receivableRows, empty: "Nenhuma linha com aceite conferido." },
    { heading: "A pagar aos produtores — por produtor e produto", columns: PAYABLE, rows: props.balance.payableRows, empty: "Nenhum recebimento conferido no galpão." },
    { heading: "Faltas encerradas sem atendimento", columns: SHORTAGES, rows: props.balance.closedShortageRows, empty: "Nenhuma falta encerrada." },
  ];
  const kgTotals = Object.entries(preview.totalsByUnit);

  return (
    <Document title={`${title} — ${props.cycleLabel}`}>
      <Page size="A4" style={[pdfStyles.page, { paddingBottom: 36 }]}>
        {frame}
        <Text style={pdfStyles.title}>{title}</Text>
        <Text style={pdfStyles.meta}>
          Emitido em {props.issuedAt} · Status do ciclo na emissão: {props.status}
        </Text>
        {props.status === "ABERTA" && <Text style={pdfStyles.openNotice}>Atenção: este ciclo ainda está ABERTO. Os valores abaixo podem mudar até o fechamento.</Text>}
        <Text style={pdfStyles.methodNotice}>
          Metodologia: a cobrar = aceito na escola (entregas + complementos - rejeições da escola) × preço congelado do pedido; a pagar = aceito no galpão
          (entrega bruta - rejeição no galpão) × (preço - desconto de logística) congelados. Rejeição na escola é perda da cooperativa e não reduz o
          pagamento do produtor. Cada linha é arredondada a centavos e o total é a soma das linhas. Valores calculados, não quitados.
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          {[
            ["Recebimentos conferidos", indicators.receiptsConferred],
            ["Valores calculados", indicators.valuesCalculated],
            ["Pronto para fechar", indicators.readyToClose],
          ].map(([label, ok]) => (
            <Text key={String(label)} style={{ fontSize: 8.5, fontWeight: 700, padding: 4, backgroundColor: ok ? "#DCE6DE" : "#F3E7BE" }}>
              {ok ? "SIM" : "NÃO"} · {String(label)}
            </Text>
          ))}
        </View>

        {[
          ["A cobrar (aceito na escola)", money(preview.receivableTotal)],
          ["A pagar aos produtores (aceito no galpão)", money(preview.payableTotal)],
          ["Margem calculada", money(preview.calculatedResult)],
          ["Custos reais registrados", props.costs ? money(totalCosts) : "não incluídos neste documento"],
          ["Resultado calculado após custos", props.costs ? money(preview.calculatedResult - totalCosts) : "—"],
        ].map(([label, value]) => (
          <View key={label} style={pdfStyles.row}>
            <Text style={[pdfStyles.cell, { width: "70%" }]}>{label}</Text>
            <Text style={[pdfStyles.cell, { width: "30%", textAlign: "right", fontWeight: 700 }]}>{value}</Text>
          </View>
        ))}

        {preview.blockers.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 9, fontWeight: 700 }}>O que impede o fechamento na emissão:</Text>
            {preview.blockers.map((b) => (
              <Text key={b} style={{ fontSize: 8.5 }}>
                • {b}
              </Text>
            ))}
          </View>
        )}
        {preview.warnings.map((w) => (
          <Text key={w} style={{ fontSize: 8.5, color: "#7a5c0a", marginTop: 4 }}>
            Aviso: {w}
          </Text>
        ))}

        <Text style={pdfStyles.sectionTitle}>Quantidades por unidade (kg e dz nunca somados)</Text>
        <Rows
          columns={[
            { header: "Unidade", width: "10%" },
            { header: "Pedido", width: "12%", align: "right" },
            { header: "Aceito escola", width: "13%", align: "right" },
            { header: "Falta (conferida)", width: "11%", align: "right" },
            { header: "Encerrada", width: "11%", align: "right" },
            { header: "Excedente", width: "11%", align: "right" },
            { header: "Rej. galpão", width: "11%", align: "right" },
            { header: "Rej. escola", width: "11%", align: "right" },
            { header: "Perda antes", width: "10%", align: "right" },
          ]}
          // Linhas a conferir não entram na falta; aparecem no bloqueio "sem conferência".
          rows={kgTotals.map(([unit, t]) =>
            [unit, t!.orderedQty, t!.acceptedAtSchoolQty, t!.shortageQty, t!.shortageClosedQty, t!.excessQty, t!.rejectedAtWarehouseQty, t!.rejectedAtSchoolQty, t!.lossBeforeSchoolQty].map((v) =>
              typeof v === "number" ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v) : v,
            ),
          )}
        />
        {props.costs && props.costs.length > 0 && (
          <>
            <Text style={pdfStyles.sectionTitle}>Custos reais registrados</Text>
            <Rows
              columns={[
                { header: "Categoria", width: "70%" },
                { header: "Valor", width: "30%", align: "right" },
              ]}
              rows={props.costs.map((c) => [c.label, money(c.amount)])}
            />
          </>
        )}
      </Page>

      {sections.flatMap((s) =>
        // Páginas só com título de seção: 36 linhas cabem com folga mesmo com
        // alguns nomes longos em duas linhas (sem quebra automática, que é lenta).
        paginate(s.rows, false, { first: 36, next: 36 }).map((pageRows, pi) => (
          <Page key={`${s.heading}-${pi}`} size="A4" style={[pdfStyles.page, { paddingBottom: 36 }]}>
            {frame}
            <Text style={pdfStyles.sectionTitle}>
              {s.heading}
              {pi > 0 ? " (continuação)" : ""}
            </Text>
            {s.rows.length === 0 ? <Text style={{ fontSize: 9 }}>{s.empty}</Text> : <Rows columns={s.columns} rows={pageRows} />}
          </Page>
        )),
      )}
    </Document>
  );
}
