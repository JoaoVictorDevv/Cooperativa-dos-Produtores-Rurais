// Leitura de PDF COM TEXTO para a grade neutra da importação. Extração local
// (pdf.js via unpdf), sem enviar o documento a nenhum serviço. PDF digitalizado
// (imagem) não tem texto: é recusado com mensagem clara — OCR não está
// disponível nesta versão (ver specs/009, plan.md).
//
// Reconstrução da tabela: agrupa os trechos de texto por linha (posição
// vertical) e atribui cada trecho à coluna do cabeçalho mais próxima
// (posição horizontal). Cada página vira uma "aba" com o mesmo nome do
// arquivo + número da página, para que cabeçalhos repetidos e subtotais de
// cada página sejam tratados como no Excel.

import { getDocumentProxy } from "unpdf";
import { normalizeText } from "./text";
import type { RawCell, RawSheet, RawWorkbook } from "./types";

interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

const LINE_TOLERANCE = 3;

function groupLines(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l[0].y - item.y) <= LINE_TOLERANCE);
    if (line) line.push(item);
    else lines.push([item]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

// Junta trechos vizinhos da mesma palavra/frase (pdf.js às vezes quebra um
// texto em pedaços colados).
function mergeAdjacent(line: TextItem[]): TextItem[] {
  const out: TextItem[] = [];
  for (const item of line) {
    const prev = out[out.length - 1];
    if (prev && item.x - (prev.x + prev.w) < 2.5) {
      prev.str += (item.x - (prev.x + prev.w) > 0.8 ? " " : "") + item.str;
      prev.w = item.x + item.w - prev.x;
    } else out.push({ ...item });
  }
  return out;
}

const HEADER_HINT = /\b(codigo|cod|pedido|escola)\b/;

function toCell(text: string): RawCell {
  const t = text.trim();
  if (!t) return { t: "empty" };
  // Número no PDF é sempre texto: a interpretação (vírgula, milhar, ambíguo)
  // fica com parseQtyText, igual a uma célula de texto do Excel.
  return { t: "text", v: t };
}

function pageToSheet(lines: TextItem[][], name: string): RawSheet {
  const headerIndex = lines.findIndex((l) => l.filter((i) => HEADER_HINT.test(normalizeText(i.str))).length >= 1 && l.length >= 3);
  if (headerIndex === -1) {
    return { name, hidden: false, rows: lines.map((l) => l.map((i) => toCell(i.str))) };
  }
  // No layout Pedido/Entrega a linha de produtos (logo abaixo) tem mais
  // colunas que a de marcadores; usa a mais completa como referência.
  const next = lines[headerIndex + 1];
  const anchorLine = next && next.length > lines[headerIndex].length ? next : lines[headerIndex];
  const anchors = anchorLine.map((i) => ({ start: i.x, end: i.x + i.w, center: i.x + i.w / 2 }));
  const rows: RawCell[][] = lines.map((line, index) => {
    if (index < headerIndex) return line.map((i) => toCell(i.str));
    const cells: string[] = anchors.map(() => "");
    for (const item of line) {
      const center = item.x + item.w / 2;
      let best = 0;
      let bestDistance = Infinity;
      anchors.forEach((a, k) => {
        const inside = center >= a.start - 4 && center <= a.end + 4;
        const distance = inside ? 0 : Math.min(Math.abs(center - a.center), Math.abs(item.x - a.start), Math.abs(item.x + item.w - a.end));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = k;
        }
      });
      cells[best] = cells[best] ? `${cells[best]} ${item.str}` : item.str;
    }
    return cells.map(toCell);
  });
  return { name, hidden: false, rows };
}

export async function readPdf(buffer: ArrayBuffer, fileName: string): Promise<RawWorkbook> {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch {
    throw new Error("Não consegui abrir este PDF.");
  }
  const sheets: RawSheet[] = [];
  let totalItems = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], w: raw.width });
    }
    totalItems += items.length;
    sheets.push(pageToSheet(groupLines(items).map(mergeAdjacent), `Página ${p}`));
  }
  if (totalItems === 0) {
    throw new Error("Este PDF não tem texto (parece digitalizado). A leitura por OCR não está disponível: peça o arquivo em Excel ou PDF gerado pelo sistema.");
  }
  return { fileName, source: "pdf", sheets };
}
