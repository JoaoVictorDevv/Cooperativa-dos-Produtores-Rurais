// Logica pura de leitura/conferencia da importacao de pedido das escolas
// (plano docs/plano-de-implementacao.md §13). Recebe uma planilha ja
// convertida em matriz de celulas (nao le o arquivo em si — isso e feito
// no servidor, em schoolOrdersImport.ts, via exceljs) e o cadastro atual
// de escolas/produtos, e devolve um resultado estruturado: o que foi
// reconhecido com certeza, e o que precisa de atencao humana.
//
// Regras absolutas desta etapa (nao violar):
// - Nunca adivinhar associacao duvidosa — so casa codigo de escola EXATO
//   (com normalizacao minima de formatacao) e nome de produto EXATO
//   (normalizado por acentuacao/maiusculas).
// - Nunca transformar erro em zero — celula invalida vira pendencia, nao
//   um pedido de "0".
// - Celula vazia = nao pedido (nao gera linha nenhuma), diferente de
//   celula com um valor que nao da pra interpretar (isso e invalida).

export type CellValue = string | number | null | undefined;

export interface KnownSchool {
  id: string;
  code: string;
  name: string;
}

export interface KnownProduct {
  id: string;
  slug: string;
  name: string;
}

export interface MatchedRow {
  rowIndex: number;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  productId: string;
  productName: string;
  productSlug: string;
  orderedQty: number;
}

export interface InvalidCell {
  rowIndex: number;
  schoolCodeRaw: string;
  productColumnLabel: string;
  rawValue: string;
  reason: string;
}

export interface ImportPreview {
  headerRowIndex: number;
  codeColIndex: number;
  nameColIndex: number | null;
  productColumns: { colIndex: number; label: string; productId: string; productName: string }[];
  matchedRows: MatchedRow[];
  unmatchedSchoolCodes: { rowIndex: number; rawCode: string; rawName: string }[];
  unmatchedProductColumns: { colIndex: number; label: string }[];
  duplicateSchoolCodes: { code: string; rowIndexes: number[] }[];
  ignoredRows: { rowIndex: number; reason: string }[];
  invalidCells: InvalidCell[];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function cellToText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// Codigos de escola as vezes chegam com espacos, ou como numero com
// ".0" no final (o Excel converte "4005" pra 4005.0 quando a coluna nao
// esta formatada como texto). Normaliza so o suficiente pra comparar,
// sem inventar equivalencias entre codigos diferentes.
function normalizeCode(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.endsWith(".0") ? trimmed.slice(0, -2) : trimmed;
}

const TOTAL_KEYWORDS = ["total", "subtotal", "soma"];

function looksLikeTotalRow(rawCode: string, rawName: string): boolean {
  const nameNorm = normalizeText(rawName);
  return TOTAL_KEYWORDS.some((k) => nameNorm.includes(k)) && rawCode === "";
}

// Acha a linha de cabecalho procurando, nas primeiras `maxScanRows`
// linhas, uma que tenha uma celula "codigo" e uma celula "escola" (ou
// "nome da escola"). Mesma heuristica validada contra a planilha real
// (v27/v35) numa sessao anterior.
function findHeaderRow(matrix: CellValue[][], maxScanRows = 15): { rowIndex: number; codeCol: number; nameCol: number | null } | null {
  const limit = Math.min(matrix.length, maxScanRows);
  for (let r = 0; r < limit; r++) {
    const row = matrix[r] ?? [];
    let codeCol = -1;
    let nameCol = -1;
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeText(cellToText(row[c]));
      if (codeCol === -1 && norm === "codigo") codeCol = c;
      if (nameCol === -1 && (norm === "escola" || norm === "nome da escola" || norm === "nome")) nameCol = c;
    }
    if (codeCol !== -1) {
      return { rowIndex: r, codeCol, nameCol: nameCol === -1 ? null : nameCol };
    }
  }
  return null;
}

function matchProductColumns(headerRow: CellValue[], codeCol: number, nameCol: number | null, products: KnownProduct[]) {
  const bySlug = new Map(products.map((p) => [normalizeText(p.slug.replace(/-/g, " ")), p]));
  const byName = new Map(products.map((p) => [normalizeText(p.name), p]));

  const matched: { colIndex: number; label: string; productId: string; productName: string }[] = [];
  const unmatched: { colIndex: number; label: string }[] = [];

  for (let c = 0; c < headerRow.length; c++) {
    if (c === codeCol || c === nameCol) continue;
    const label = cellToText(headerRow[c]);
    if (!label) continue;
    const norm = normalizeText(label);
    const product = byName.get(norm) ?? bySlug.get(norm);
    if (product) {
      matched.push({ colIndex: c, label, productId: product.id, productName: product.name });
    } else {
      unmatched.push({ colIndex: c, label });
    }
  }
  return { matched, unmatched };
}

function parseQty(raw: CellValue): { ok: true; value: number } | { ok: false; reason: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: 0 };
  if (typeof raw === "number") {
    if (Number.isNaN(raw)) return { ok: false, reason: "Valor não é um número." };
    if (raw < 0) return { ok: false, reason: "Quantidade negativa." };
    return { ok: true, value: raw };
  }
  const text = raw.trim();
  if (text === "") return { ok: true, value: 0 };
  const normalized = text.replace(/\./g, "").replace(",", ".");
  // se o texto tinha só um separador decimal (vírgula OU ponto único), tenta o caminho simples primeiro
  const simple = Number(text.replace(",", "."));
  const value = Number.isFinite(simple) ? simple : Number(normalized);
  if (!Number.isFinite(value)) return { ok: false, reason: `"${text}" não é um número reconhecível.` };
  if (value < 0) return { ok: false, reason: "Quantidade negativa." };
  return { ok: true, value };
}

export function buildImportPreview(matrix: CellValue[][], schools: KnownSchool[], products: KnownProduct[]): ImportPreview | { error: string } {
  const header = findHeaderRow(matrix);
  if (!header) {
    return { error: 'Não encontrei uma linha de cabeçalho com uma coluna "CÓDIGO" nas primeiras 15 linhas da planilha.' };
  }
  const { rowIndex: headerRowIndex, codeCol: codeColIndex, nameCol: nameColIndex } = header;
  const headerRow = matrix[headerRowIndex] ?? [];
  const { matched: productColumns, unmatched: unmatchedProductColumns } = matchProductColumns(headerRow, codeColIndex, nameColIndex, products);

  const schoolByCode = new Map(schools.map((s) => [normalizeCode(s.code), s]));

  const matchedRows: MatchedRow[] = [];
  const unmatchedSchoolCodes: ImportPreview["unmatchedSchoolCodes"] = [];
  const ignoredRows: ImportPreview["ignoredRows"] = [];
  const invalidCells: InvalidCell[] = [];
  const codeOccurrences = new Map<string, number[]>();

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const rawCode = cellToText(row[codeColIndex]);
    const rawName = nameColIndex !== null ? cellToText(row[nameColIndex]) : "";

    if (rawCode === "" && rawName === "") continue; // linha em branco, ignora silenciosamente
    if (looksLikeTotalRow(rawCode, rawName)) {
      ignoredRows.push({ rowIndex: r, reason: `Linha "${rawName}" parece ser total/subtotal, não uma escola.` });
      continue;
    }

    const normalizedCode = normalizeCode(rawCode);
    const school = schoolByCode.get(normalizedCode);
    if (!school) {
      unmatchedSchoolCodes.push({ rowIndex: r, rawCode, rawName });
      continue;
    }

    codeOccurrences.set(normalizedCode, [...(codeOccurrences.get(normalizedCode) ?? []), r]);

    for (const col of productColumns) {
      const raw = row[col.colIndex];
      const parsed = parseQty(raw);
      if (!parsed.ok) {
        invalidCells.push({
          rowIndex: r,
          schoolCodeRaw: rawCode,
          productColumnLabel: col.label,
          rawValue: cellToText(raw),
          reason: parsed.reason,
        });
        continue;
      }
      if (parsed.value === 0) continue; // celula vazia/zero = nao pedido, nao gera linha
      const product = products.find((p) => p.id === col.productId)!;
      matchedRows.push({
        rowIndex: r,
        schoolId: school.id,
        schoolCode: school.code,
        schoolName: school.name,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        orderedQty: parsed.value,
      });
    }
  }

  const duplicateSchoolCodes = [...codeOccurrences.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([code, rowIndexes]) => ({ code, rowIndexes }));

  // Codigo que apareceu mais de uma vez no arquivo e ambiguo (nao da pra
  // saber qual linha vale) — remove as linhas correspondentes do
  // resultado ao inves de escolher uma arbitrariamente.
  const ambiguousRowIndexes = new Set(duplicateSchoolCodes.flatMap((d) => d.rowIndexes));
  const finalMatchedRows = matchedRows.filter((row) => !ambiguousRowIndexes.has(row.rowIndex));

  return {
    headerRowIndex,
    codeColIndex,
    nameColIndex,
    productColumns,
    matchedRows: finalMatchedRows,
    unmatchedSchoolCodes,
    unmatchedProductColumns,
    duplicateSchoolCodes,
    ignoredRows,
    invalidCells,
  };
}
