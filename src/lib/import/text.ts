// Normalização e interpretação de textos/números da importação. Regras
// explícitas, sem adivinhação: quando há duas leituras possíveis, devolve as
// duas e deixa a decisão para quem confere.

import { round2 } from "../calc";
import type { CatalogSchool, CellParse, RawCell } from "./types";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_/.,;:()'"ºª°]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellText(cell: RawCell | undefined): string {
  if (!cell) return "";
  switch (cell.t) {
    case "number":
      return String(cell.v);
    case "text":
      return cell.v.trim();
    case "date":
      return cell.v;
    case "bool":
      return cell.v ? "VERDADEIRO" : "FALSO";
    case "error":
      return cell.v;
    default:
      return "";
  }
}

export function isEmptyCell(cell: RawCell | undefined): boolean {
  return !cell || cell.t === "empty" || cell.t === "merged" || (cell.t === "text" && cell.v.trim() === "");
}

const CODE_TEXT = /^\d{1,7}(\.\d+)?$/;

// Código de escola: número inteiro, ou com sufixo de modalidade (1096.1). Um
// "4005.0" vira "4005" (formatação do Excel), mas "1096.1" continua "1096.1"
// — não é o mesmo código que 1096 sem confirmação de quem confere.
export function parseSchoolCode(cell: RawCell | undefined): { ok: true; code: string } | { ok: false; unreadable: boolean } {
  if (!cell) return { ok: false, unreadable: false };
  if (cell.t === "number") {
    if (cell.v <= 0 || cell.v >= 1e7) return { ok: false, unreadable: false };
    return { ok: true, code: String(cell.v) };
  }
  if (cell.t === "text") {
    const t = cell.v.trim();
    if (!CODE_TEXT.test(t)) return { ok: false, unreadable: false };
    return { ok: true, code: t.replace(/\.0+$/, "") };
  }
  if (cell.t === "date") return { ok: false, unreadable: true };
  return { ok: false, unreadable: false };
}

export function isCodeLike(cell: RawCell | undefined): boolean {
  return parseSchoolCode(cell).ok;
}

const INVALID_FORMULA = "Fórmula sem resultado calculado no arquivo (não é zero). Abra e salve a planilha no Excel para gerar o valor.";

// Quantidade de uma célula de Pedido. Vazio = não informado (não apaga nada);
// zero explícito = zero. Mais de 2 casas decimais não é arredondado aqui: vira
// PRECISAO e só é gravado se a regra de arredondamento for aceita na prévia.
export function parseQtyCell(cell: RawCell | undefined): CellParse {
  if (!cell || cell.t === "empty" || cell.t === "merged") return { k: "VAZIO" };
  switch (cell.t) {
    case "number":
      return fromNumber(cell.v, String(cell.v));
    case "text":
      return parseQtyText(cell.v);
    case "formula_no_result":
      return { k: "INVALIDO", text: `=${cell.f}`, reason: INVALID_FORMULA };
    case "error":
      return { k: "INVALIDO", text: cell.v, reason: `Erro na célula (${cell.v}).` };
    case "date":
      return { k: "INVALIDO", text: cell.v, reason: "Data em célula de quantidade." };
    case "bool":
      return { k: "INVALIDO", text: String(cell.v), reason: "Verdadeiro/falso em célula de quantidade." };
  }
}

function fromNumber(value: number, text: string): CellParse {
  if (!Number.isFinite(value)) return { k: "INVALIDO", text, reason: "Não é um número." };
  if (value < 0) return { k: "INVALIDO", text, reason: "Quantidade negativa." };
  const rounded = round2(value);
  // Diferença de representação binária (1.7999999999999998) não é casa decimal real.
  if (Math.abs(value - rounded) < 1e-9) return { k: "OK", v: rounded };
  return { k: "PRECISAO", original: value, rounded };
}

export function parseQtyText(raw: string): CellParse {
  const text = raw.trim().replace(/\s+/g, "");
  if (text === "") return { k: "VAZIO" };
  if (/^\d+$/.test(text)) return fromNumber(Number(text), raw);
  // 1.000 ou 12.500: milhar (1000) ou decimal com ponto (1,0)? Não adivinhar.
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) {
    return { k: "AMBIGUO", text: raw, options: [Number(text), Number(text.replace(/\./g, ""))] };
  }
  // 1,500: decimal brasileiro (1,5) ou milhar em inglês (1500)?
  if (/^[1-9]\d{0,2},\d{3}$/.test(text)) {
    return { k: "AMBIGUO", text: raw, options: [Number(text.replace(",", ".")), Number(text.replace(",", ""))] };
  }
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(text)) return fromNumber(Number(text.replace(/\./g, "").replace(",", ".")), raw);
  if (/^\d+,\d+$/.test(text)) return fromNumber(Number(text.replace(",", ".")), raw);
  if (/^\d+\.\d+$/.test(text)) return fromNumber(Number(text), raw);
  if (/^-\d/.test(text)) return { k: "INVALIDO", text: raw, reason: "Quantidade negativa." };
  return { k: "INVALIDO", text: raw, reason: `"${raw.trim()}" não é uma quantidade reconhecível.` };
}

// Palavras que não distinguem uma instituição de outra.
const GENERIC_NAME_WORDS = new Set([
  "escola", "municipal", "municipalizada", "estadual", "cei", "emei", "em", "ee", "e", "m",
  "colegio", "centro", "educacao", "educacional", "infantil", "integral", "creche", "de", "da",
  "do", "das", "dos", "instituto", "ensino", "fundamental", "unidade", "ue", "prof", "profa",
  "professor", "professora", "dr", "dra",
]);

export function distinctiveTokens(name: string): string[] {
  return normalizeText(name)
    .split(" ")
    .filter((t) => t.length >= 2 && !GENERIC_NAME_WORDS.has(t));
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  // Nome truncado na planilha ("LAMAR" × "LAMARE").
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

export function nameSimilarity(a: string, b: string): number | null {
  const ta = distinctiveTokens(a);
  const tb = distinctiveTokens(b);
  if (ta.length === 0 || tb.length === 0) return null;
  const common = ta.filter((x) => tb.some((y) => tokenMatches(x, y))).length;
  return common / Math.min(ta.length, tb.length);
}

// Mesmo código, nome compatível? Diferença de abreviação é aceita (mesma
// instituição); nomes sem palavra distintiva em comum são conflito.
export function namesCompatible(fileName: string, catalogName: string): boolean {
  if (!fileName.trim()) return true;
  const sim = nameSimilarity(fileName, catalogName);
  return sim === null || sim >= 0.5;
}

export function suggestSchools(rawCode: string, rawName: string, schools: CatalogSchool[], limit = 3): string[] {
  const out: string[] = [];
  const base = rawCode.includes(".") ? rawCode.split(".")[0] : null;
  if (base) {
    const byBase = schools.find((s) => s.code === base);
    if (byBase) out.push(byBase.id);
  }
  if (rawName.trim()) {
    const scored = schools
      .map((s) => ({ id: s.id, score: nameSimilarity(rawName, s.name) ?? 0 }))
      .filter((s) => s.score >= 0.5 && !out.includes(s.id))
      .sort((x, y) => y.score - x.score);
    out.push(...scored.slice(0, limit).map((s) => s.id));
  }
  return out.slice(0, limit);
}

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg", kgs: "kg", quilo: "kg", quilos: "kg",
  dz: "dz", duzia: "dz", duzias: "dz",
  un: "un", und: "un", unid: "un", unidade: "un", unidades: "un",
  cx: "cx", caixa: "cx", caixas: "cx",
  pct: "pct", pacote: "pct", pacotes: "pct",
  maco: "maco", macos: "maco",
  l: "l", litro: "l", litros: "l",
};

// "Ovos (dz)" → { base: "ovos", unit: "dz" }.
export function parseHeaderLabel(label: string): { base: string; unit: string | null } {
  const m = label.match(/\(([^)]+)\)\s*$/);
  if (m) {
    const unit = UNIT_ALIASES[normalizeText(m[1])];
    if (unit) return { base: normalizeText(label.slice(0, m.index)), unit };
  }
  return { base: normalizeText(label), unit: null };
}
