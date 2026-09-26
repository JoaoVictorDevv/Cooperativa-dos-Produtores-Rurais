// Reconhecimento de uma aba (ou página de PDF) do pedido da prefeitura.
// Suporta dois layouts, sempre informando o que foi reconhecido para que
// quem confere possa verificar:
// - PEDIDO_ENTREGA (ex.: planilha GZ): uma linha marca "Pedido"/"Entrega" e a
//   linha seguinte traz os produtos. Só as colunas de Pedido são candidatas;
//   Entrega do arquivo não comprova recebimento na nossa operação.
// - SIMPLES (planilha da cooperativa): linha de cabeçalho com "CÓDIGO",
//   "ESCOLA" e uma coluna por produto.

import {
  cellText,
  colLetter,
  isCodeLike,
  isEmptyCell,
  namesCompatible,
  normalizeText,
  parseHeaderLabel,
  parseQtyCell,
  parseSchoolCode,
  suggestSchools,
} from "./text";
import type {
  CatalogProduct,
  CatalogSchool,
  ColumnMatch,
  ParsedColumn,
  ParsedRow,
  ParsedSheet,
  RawCell,
  RawSheet,
} from "./types";

const HEADER_SCAN_ROWS = 20;
const QUANTITY_LIKE_HEADER = /\b(numero|n|no|nº|atendimento|atendimentos|alunos|quantidade|total|frequencia|frequencias|per capita)\b/;
const CODE_HEADER = /\b(codigo|cod|cod escola|escola|ue|unidade)\b/;
const TOTAL_TEXT = /\b(sub ?total|total|soma)\b/;

function rowTexts(row: RawCell[] | undefined): string[] {
  return (row ?? []).map((c) => normalizeText(cellText(c)));
}

function isBlankRow(row: RawCell[] | undefined): boolean {
  return !row || row.every((c) => isEmptyCell(c));
}

export function matchProduct(label: string, products: CatalogProduct[]): { match: ColumnMatch; unit: string | null } {
  const { base, unit } = parseHeaderLabel(label);
  const keyOf = (p: CatalogProduct) => [normalizeText(p.name), normalizeText(p.slug.replace(/-/g, " "))];
  const exact = products.find((p) => keyOf(p).includes(base));
  if (exact) {
    return { unit, match: exact.offered ? { kind: "AUTO", productId: exact.id } : { kind: "FORA_DA_OFERTA", retiredProductId: exact.id } };
  }
  // Singular/plural ("Ovo" × "Ovos"): nunca automático.
  const plural = products.find((p) => keyOf(p).some((k) => k === `${base}s` || `${k}s` === base));
  if (plural) {
    return { unit, match: plural.offered ? { kind: "SUGESTAO", candidateIds: [plural.id] } : { kind: "FORA_DA_OFERTA", retiredProductId: plural.id } };
  }
  // Nome genérico ("Alface", "Couve"): sugere, mas exige confirmação.
  const generic = products.filter((p) => p.offered && keyOf(p).some((k) => k.startsWith(`${base} `)));
  if (base && generic.length) return { unit, match: { kind: "SUGESTAO", candidateIds: generic.map((p) => p.id) } };
  return { unit, match: { kind: "NAO_RECONHECIDA" } };
}

interface Layout {
  layout: "PEDIDO_ENTREGA" | "SIMPLES";
  headerRows: number[]; // índices 0-based
  labelRow: number;
  orderCols: number[];
  deliveryCols: number;
  firstOrderCol: number;
  codeHeaderCol?: number;
  nameHeaderCol?: number;
}

function detectLayout(rows: RawCell[][]): Layout | null {
  const limit = Math.min(rows.length, HEADER_SCAN_ROWS);
  for (let r = 0; r < limit; r++) {
    const texts = rowTexts(rows[r]);
    const pedido = texts.map((t, c) => (t === "pedido" || t.startsWith("pedido ") ? c : -1)).filter((c) => c >= 0);
    const entrega = texts.filter((t) => t === "entrega" || t.startsWith("entrega ")).length;
    if (pedido.length >= 1 && pedido.length + entrega >= 2) {
      const labelRow = r + 1;
      return {
        layout: "PEDIDO_ENTREGA",
        headerRows: [r, labelRow],
        labelRow,
        orderCols: pedido,
        deliveryCols: entrega,
        firstOrderCol: Math.min(...pedido),
      };
    }
  }
  for (let r = 0; r < limit; r++) {
    const texts = rowTexts(rows[r]);
    const codeCol = texts.findIndex((t) => t === "codigo" || t === "cod" || t === "codigo da escola" || t === "cod escola");
    if (codeCol === -1) continue;
    const nameCol = texts.findIndex((t, c) => c !== codeCol && (t === "escola" || t === "nome" || t === "nome da escola" || t === "unidade escolar"));
    const orderCols = texts.map((t, c) => (t && c !== codeCol && c !== nameCol ? c : -1)).filter((c) => c >= 0);
    return {
      layout: "SIMPLES",
      headerRows: [r],
      labelRow: r,
      orderCols,
      deliveryCols: 0,
      firstOrderCol: orderCols.length ? Math.min(...orderCols) : texts.length,
      codeHeaderCol: codeCol,
      nameHeaderCol: nameCol === -1 ? undefined : nameCol,
    };
  }
  return null;
}

function pickCodeAndNameColumns(rows: RawCell[][], layout: Layout): { codeCol: number | null; nameCol: number | null } {
  const dataStart = layout.labelRow + 1;
  const dataRows = rows.slice(dataStart);
  if (layout.codeHeaderCol !== undefined) {
    return { codeCol: layout.codeHeaderCol, nameCol: layout.nameHeaderCol ?? null };
  }
  const labels = rowTexts(rows[layout.labelRow]);
  const candidates: { col: number; codes: number; preferred: boolean }[] = [];
  for (let c = 0; c < layout.firstOrderCol; c++) {
    if (QUANTITY_LIKE_HEADER.test(labels[c] ?? "")) continue;
    const codes = dataRows.filter((row) => isCodeLike(row?.[c])).length;
    if (codes >= 1) candidates.push({ col: c, codes, preferred: CODE_HEADER.test(labels[c] ?? "") });
  }
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.codes - a.codes || a.col - b.col);
  const codeCol = candidates[0]?.col ?? null;
  let nameCol: number | null = null;
  let best = 0;
  for (let c = 0; c < layout.firstOrderCol; c++) {
    if (c === codeCol) continue;
    const names = dataRows.filter((row) => {
      const cell = row?.[c];
      return cell?.t === "text" && /[a-zA-ZÀ-ú]{3,}/.test(cell.v);
    }).length;
    if (names > best) {
      best = names;
      nameCol = c;
    }
  }
  return { codeCol, nameCol };
}

function findUpdateMarker(rows: RawCell[][]): string | undefined {
  for (const row of rows.slice(0, 5)) {
    for (const cell of row ?? []) {
      const t = cellText(cell);
      if (/atualiza/i.test(t)) return t;
    }
  }
  return undefined;
}

export function parseSheet(sheet: RawSheet, schools: CatalogSchool[], products: CatalogProduct[]): ParsedSheet {
  const base: ParsedSheet = {
    name: sheet.name,
    hidden: sheet.hidden,
    kind: "NAO_RECONHECIDA",
    headerRows: [],
    columns: [],
    deliveryColumnsIgnored: 0,
    otherColumnsIgnored: [],
    rows: [],
    ignoredRows: [],
    unrecognizedRows: [],
    updateMarker: findUpdateMarker(sheet.rows),
  };
  const rows = sheet.rows;
  if (rows.every((r) => isBlankRow(r))) return { ...base, kind: "VAZIA", reason: "Aba vazia." };

  const layout = detectLayout(rows);
  if (!layout) {
    return { ...base, reason: 'Não encontrei cabeçalho com "Pedido"/"Entrega" nem com "CÓDIGO" nas primeiras 20 linhas.' };
  }
  const { codeCol, nameCol } = pickCodeAndNameColumns(rows, layout);
  const headerRows = layout.headerRows.map((r) => r + 1);

  const labels = rows[layout.labelRow] ?? [];
  const columns: ParsedColumn[] = layout.orderCols.map((c) => {
    const label = cellText(labels[c]) || `(coluna ${colLetter(c)} sem nome)`;
    const { match, unit } = matchProduct(label, products);
    return { col: c, letter: colLetter(c), label, unit, match };
  });
  const otherColumnsIgnored: { letter: string; label: string }[] = [];
  for (let c = 0; c < layout.firstOrderCol; c++) {
    if (c === codeCol || c === nameCol) continue;
    const label = cellText(labels[c]);
    if (label) otherColumnsIgnored.push({ letter: colLetter(c), label });
  }

  const common = {
    ...base,
    layout: layout.layout,
    headerRows,
    codeCol: codeCol === null ? undefined : colLetter(codeCol),
    nameCol: nameCol === null ? null : colLetter(nameCol),
    columns,
    deliveryColumnsIgnored: layout.deliveryCols,
    otherColumnsIgnored,
  };

  if (codeCol === null) {
    const hasTotals = rows.some((row) => rowTexts(row).some((t) => TOTAL_TEXT.test(t)));
    return hasTotals
      ? { ...common, kind: "TOTALIZACAO", reason: "Só há linhas de total/subtotal, sem códigos de escola." }
      : { ...common, reason: "Não encontrei uma coluna com códigos de escola antes das colunas de pedido." };
  }

  const schoolByCode = new Map(schools.map((s) => [s.code.trim(), s]));
  const headerLabelSet = new Set(columns.map((c) => normalizeText(c.label)));
  const parsedRows: ParsedRow[] = [];
  const ignoredRows: ParsedSheet["ignoredRows"] = [];
  const unrecognizedRows: ParsedSheet["unrecognizedRows"] = [];
  let dataStarted = false;

  for (let r = layout.labelRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (isBlankRow(row)) continue;
    const excelRow = r + 1;
    const codeCell = row?.[codeCol];
    const code = parseSchoolCode(codeCell);
    const rawName = nameCol === null ? "" : cellText(row?.[nameCol]);
    const texts = rowTexts(row);

    if (!code.ok && !code.unreadable) {
      if (texts.some((t) => TOTAL_TEXT.test(t))) {
        ignoredRows.push({ row: excelRow, reason: "Linha de total/subtotal." });
        continue;
      }
      const repeatsHeader = columns.filter((c) => headerLabelSet.has(normalizeText(cellText(row?.[c.col])))).length;
      if (columns.length > 0 && repeatsHeader >= Math.ceil(columns.length / 2)) {
        ignoredRows.push({ row: excelRow, reason: "Cabeçalho repetido." });
        continue;
      }
      if (texts.some((t) => t === "pedido" || t === "entrega")) {
        ignoredRows.push({ row: excelRow, reason: "Cabeçalho repetido." });
        continue;
      }
      if (!dataStarted) {
        ignoredRows.push({ row: excelRow, reason: "Linha de parâmetros antes dos dados (frequência, per capita etc.)." });
        continue;
      }
      unrecognizedRows.push({ row: excelRow, text: (row ?? []).map((c) => cellText(c)).filter(Boolean).slice(0, 4).join(" | ") });
      continue;
    }

    dataStarted = true;
    const cells = columns.map((c) => parseQtyCell(row?.[c.col]));
    if (!code.ok) {
      parsedRows.push({
        row: excelRow,
        rawCode: cellText(codeCell),
        rawName,
        school: { k: "CODIGO_ILEGIVEL", suggestionIds: suggestSchools("", rawName, schools) },
        cells,
      });
      continue;
    }
    const school = schoolByCode.get(code.code);
    let status: ParsedRow["school"];
    if (!school) status = { k: "DESCONHECIDA", suggestionIds: suggestSchools(code.code, rawName, schools) };
    else if (!namesCompatible(rawName, school.name)) status = { k: "NOME_DIVERGENTE", schoolId: school.id };
    else status = { k: "OK", schoolId: school.id };
    parsedRows.push({ row: excelRow, rawCode: code.code, rawName, school: status, cells });
  }

  if (parsedRows.length === 0) {
    const kind = ignoredRows.some((r) => r.reason.startsWith("Linha de total")) ? "TOTALIZACAO" : "NAO_RECONHECIDA";
    return { ...common, kind, reason: "Nenhuma linha com código de escola.", ignoredRows, unrecognizedRows };
  }
  return { ...common, kind: "PEDIDOS", rows: parsedRows, ignoredRows, unrecognizedRows };
}
