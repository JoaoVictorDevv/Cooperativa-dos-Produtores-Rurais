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
  // Aviso de destaque logo abaixo do título (ex.: metodologia antiga).
  notice?: string;
  landscape?: boolean;
}

// Identificação do ciclo repetida em todas as páginas (fixed) e numeração.
export function PageFrame({ title, weekNumber, weekRange, weekStatus }: { title: string; weekNumber: number; weekRange: string; weekStatus: WeekStatus }) {
  return (
    <>
      <View fixed style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.5, borderBottomColor: "#999", paddingBottom: 3, marginBottom: 6 }}>
        <Text style={{ fontSize: 7.5, color: "#444" }}>
          {COOP_NAME} · {title}
        </Text>
        <Text style={{ fontSize: 7.5, color: "#444" }}>
          Semana {weekNumber} ({weekRange}) · {weekStatus === "ABERTA" ? "ABERTA — valores podem mudar" : "FECHADA"}
        </Text>
      </View>
      <Text
        fixed
        style={{ position: "absolute", bottom: 14, right: 28, fontSize: 7.5, color: "#555" }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </>
  );
}

export function TableHeader({ columns }: { columns: ReportColumn[] }) {
  return (
    <View style={pdfStyles.headerRow} fixed>
      {columns.map((c, i) => (
        <Text key={i} style={[pdfStyles.headerCell, { width: c.width, textAlign: c.align ?? "left" }]}>
          {c.header}
        </Text>
      ))}
    </View>
  );
}

// Paginação feita aqui (e não pelo react-pdf): com milhares de linhas a
// quebra automática fica ~10× mais lenta. Se uma página transbordar (nome
// longo em duas linhas), o react-pdf quebra o resto e o cabeçalho fixo se repete.
const ROWS_PER_PAGE = { portrait: { first: 34, next: 44 }, landscape: { first: 20, next: 28 } };

export function paginate<T>(rows: T[], landscape?: boolean): T[][] {
  const { first, next } = landscape ? ROWS_PER_PAGE.landscape : ROWS_PER_PAGE.portrait;
  const pages: T[][] = [rows.slice(0, first)];
  for (let i = first; i < rows.length; i += next) pages.push(rows.slice(i, i + next));
  return pages;
}

// Documento tabular genérico (pedido das escolas, pedidos aos produtores,
// galpão, entregas, diferenças). Identifica o ciclo e a emissão, avisa
// quando o ciclo está aberto e repete cabeçalho e numeração em cada página.
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
  notice,
  landscape,
}: SimpleReportProps) {
  const pages = paginate(rows, landscape);
  return (
    <Document title={`${title} — Semana ${weekNumber}`}>
      {pages.map((pageRows, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation={landscape ? "landscape" : "portrait"} style={[pdfStyles.page, { paddingBottom: 36 }]}>
          <PageFrame title={title} weekNumber={weekNumber} weekRange={weekRange} weekStatus={weekStatus} />
          {pageIndex === 0 && (
            <>
              <Text style={pdfStyles.title}>{title}</Text>
              <Text style={pdfStyles.meta}>
                Emitido em {issuedAt} · Status do ciclo na emissão: {weekStatus}
              </Text>
              {weekStatus === "ABERTA" && (
                <Text style={pdfStyles.openNotice}>Atenção: este ciclo ainda está ABERTO. Os valores abaixo podem mudar até o fechamento.</Text>
              )}
              {notice && <Text style={pdfStyles.methodNotice}>{notice}</Text>}
            </>
          )}
          <TableHeader columns={columns} />
          {pageRows.map((r, ri) => (
            <View key={ri} style={pdfStyles.row}>
              {r.map((v, ci) => (
                <Text key={ci} style={[pdfStyles.cell, { width: columns[ci].width, textAlign: columns[ci].align ?? "left" }]}>
                  {String(v)}
                </Text>
              ))}
            </View>
          ))}
          {rows.length === 0 && <Text style={{ fontSize: 9, marginTop: 10 }}>{emptyMessage ?? "Nenhum registro neste ciclo."}</Text>}
          {pageIndex === pages.length - 1 && footNote && <Text style={pdfStyles.footNote}>{footNote}</Text>}
        </Page>
      ))}
    </Document>
  );
}
