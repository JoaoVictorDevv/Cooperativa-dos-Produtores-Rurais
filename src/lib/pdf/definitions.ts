// Metadados leves dos documentos da semana (plano §12) — separado de
// reports.tsx pra paginas que so precisam listar/linkar os documentos
// nao precisarem carregar o @react-pdf/renderer inteiro.
export const REPORT_DEFINITIONS = [
  { key: "pedido-escolas", label: "Pedido das Escolas" },
  { key: "pedido-produtores", label: "Pedidos aos Produtores" },
  { key: "romaneios-escolas", label: "Romaneios das Escolas" },
  { key: "recebimento-galpao", label: "Recebimento e Devoluções no Galpão" },
  { key: "entregas-escolas", label: "Entregas às Escolas" },
  { key: "diferenca", label: "Relatório de Diferenças" },
  { key: "balanco", label: "Balanço Financeiro" },
] as const;

export type ReportKey = (typeof REPORT_DEFINITIONS)[number]["key"];

export function isReportKey(value: string): value is ReportKey {
  return REPORT_DEFINITIONS.some((r) => r.key === value);
}
