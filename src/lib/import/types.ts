// Tipos da importação do pedido da prefeitura (specs/009-importacao-pedido-prefeitura).
// A leitura do arquivo (Excel ou PDF) produz uma grade neutra (RawWorkbook);
// o reconhecimento (parseSheet) e o plano de gravação (plan) são puros e
// servem aos dois formatos.

export type RawCell =
  | { t: "empty" }
  | { t: "number"; v: number }
  | { t: "text"; v: string }
  | { t: "date"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "error"; v: string }
  | { t: "formula_no_result"; f: string }
  | { t: "merged" };

export interface RawSheet {
  name: string;
  hidden: boolean;
  rows: RawCell[][];
}

export interface RawWorkbook {
  fileName: string;
  source: "xlsx" | "pdf";
  sheets: RawSheet[];
}

export interface CatalogSchool {
  id: string;
  code: string;
  name: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  unit: "kg" | "dz";
  // Na oferta ativa: ativo no cadastro e não retirado (ex.: Ovos).
  offered: boolean;
}

export type SheetKind = "PEDIDOS" | "TOTALIZACAO" | "VAZIA" | "NAO_RECONHECIDA";

export type ColumnMatch =
  | { kind: "AUTO"; productId: string }
  | { kind: "SUGESTAO"; candidateIds: string[] }
  | { kind: "FORA_DA_OFERTA"; retiredProductId: string | null }
  | { kind: "NAO_RECONHECIDA" };

export interface ParsedColumn {
  col: number;
  letter: string;
  label: string;
  unit: string | null;
  match: ColumnMatch;
}

export type CellParse =
  | { k: "VAZIO" }
  | { k: "OK"; v: number }
  | { k: "PRECISAO"; original: number; rounded: number }
  | { k: "AMBIGUO"; text: string; options: [number, number] }
  | { k: "INVALIDO"; text: string; reason: string };

export type RowSchool =
  | { k: "OK"; schoolId: string }
  | { k: "NOME_DIVERGENTE"; schoolId: string }
  | { k: "DESCONHECIDA"; suggestionIds: string[] }
  | { k: "CODIGO_ILEGIVEL"; suggestionIds: string[] };

export interface ParsedRow {
  // Número da linha como aparece no Excel (1 = primeira linha).
  row: number;
  rawCode: string;
  rawName: string;
  school: RowSchool;
  // Alinhado com ParsedSheet.columns.
  cells: CellParse[];
}

export interface ParsedSheet {
  name: string;
  hidden: boolean;
  kind: SheetKind;
  reason?: string;
  updateMarker?: string;
  layout?: "PEDIDO_ENTREGA" | "SIMPLES";
  headerRows: number[];
  codeCol?: string;
  nameCol?: string | null;
  columns: ParsedColumn[];
  deliveryColumnsIgnored: number;
  otherColumnsIgnored: { letter: string; label: string }[];
  rows: ParsedRow[];
  ignoredRows: { row: number; reason: string }[];
  unrecognizedRows: { row: number; text: string }[];
}

export interface ParsedWorkbook {
  fileName: string;
  source: "xlsx" | "pdf";
  sheets: ParsedSheet[];
}
