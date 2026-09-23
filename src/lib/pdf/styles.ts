import { StyleSheet } from "@react-pdf/renderer";

// Estilos compartilhados por todos os documentos (plano §12): precisam
// ser legiveis, identificar a semana e a data de emissao, e avisar
// quando a semana ainda esta aberta.
export const pdfStyles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  brand: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  sub: { fontSize: 9, color: "#444", marginBottom: 10 },
  title: { fontSize: 14, fontWeight: 700, marginTop: 4, marginBottom: 2 },
  meta: { fontSize: 8, color: "#555", marginBottom: 8 },
  openNotice: {
    fontSize: 8.5,
    color: "#8B3A2E",
    backgroundColor: "#FBEDE9",
    padding: 6,
    marginBottom: 10,
    fontWeight: 700,
  },
  footNote: { marginTop: 14, fontSize: 7.5, color: "#555", lineHeight: 1.4 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 3,
  },
  headerCell: { fontSize: 8, fontWeight: 700, paddingHorizontal: 3 },
  cell: { fontSize: 8, paddingHorizontal: 3 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
});

export function fmtMoneyPdf(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function fmtDatePdf(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function fmtDateTimePdf(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export const COOP_NAME = "COOPERATIVA DOS PRODUTORES RURAIS DE PETRÓPOLIS";

// Dados cadastrais (nome/endereco de escola e produtor) nao tem
// historico — refletem o cadastro ATUAL, nao necessariamente o que
// valia na data da semana. So quantidades e precos sao congelados por
// semana. Ver docs/plano-de-implementacao.md §12.
export const CADASTRO_DISCLAIMER =
  "Nomes, enderecos e telefones refletem o cadastro atual (nao tem historico proprio). Apenas quantidades, precos e valores desta semana sao os que valiam na data dela.";
