// Lê a "Planilha de Pedido" da Prefeitura (formato conferido nos pedidos de
// 05/10, 20/10 e 26/10/2026):
// - abas "Modalidade - UE", "... UE Integral", "... EMEI" e "... CEI";
//   linha 1 "Pedido"/"Entrega", linha 2 o produto, escolas da linha 6 até
//   "Subtotal Escolas =";
// - aba "TOTAL": a linha com "TOTAL=" na coluna B tem o total de cada produto.
// Só as colunas "Pedido" interessam.

import ExcelJS from "exceljs";

export const MODALIDADES = ["UE", "UE Integral", "EMEI", "CEI"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

const APELIDOS: Record<string, string> = {
  alface: "Alface lisa",
  couve: "Couve manteiga",
  "cheiro-verde": "Cheiro verde",
  maca: "Maçã gala",
  ovo: "Ovos (dz)",
  ovos: "Ovos (dz)",
  tangerina: "Tangerina ponkan",
};

const chave = (t: string) =>
  t
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export function nomeNosso(nomePrefeitura: string, nossos: string[]): string | null {
  const k = chave(nomePrefeitura);
  if (APELIDOS[k]) return APELIDOS[k];
  return nossos.find((n) => chave(n) === k) ?? null;
}

// Código da unidade como texto. Cuidado real: no arquivo da Prefeitura o Excel
// transformou "2033.2" em data (01/02/2033) — data volta a ser "ano.mês".
export function codigoUnidade(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return `${v.getUTCFullYear()}.${v.getUTCMonth() + 1}`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  const t = String(v).trim();
  return /^\d+(\.\d+)?$/.test(t) ? t : null;
}

function valor(c: ExcelJS.Cell): unknown {
  const v = c.value as unknown;
  if (v && typeof v === "object" && "result" in (v as object)) return (v as { result: unknown }).result;
  if (v && typeof v === "object" && "richText" in (v as object)) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  return v;
}

export interface LinhaPedido {
  codigo: string;
  modalidade: Modalidade;
  produto: string; // nome da nossa planilha
  kg: number;
}

export interface PedidoLido {
  linhas: LinhaPedido[];
  totalPrefeitura: Record<string, number>;
  foraDaLista: Record<string, number>; // produtos que a cooperativa não tem
  semCodigo: string[]; // linhas com pedido sem código de escola (ex.: "GAE")
}

export async function lerPedidoPrefeitura(arquivo: ArrayBuffer | Buffer | string, nossos: string[]): Promise<PedidoLido> {
  const wb = new ExcelJS.Workbook();
  if (typeof arquivo === "string") await wb.xlsx.readFile(arquivo);
  else await wb.xlsx.load(arquivo as ArrayBuffer);
  const faltando = MODALIDADES.filter((m) => !wb.getWorksheet(`Modalidade - ${m}`));
  if (faltando.length) throw new Error(`Este arquivo não parece o pedido da Prefeitura: faltam as abas ${faltando.map((m) => `"Modalidade - ${m}"`).join(", ")}.`);

  const res: PedidoLido = { linhas: [], totalPrefeitura: {}, foraDaLista: {}, semCodigo: [] };
  for (const modalidade of MODALIDADES) {
    const ws = wb.getWorksheet(`Modalidade - ${modalidade}`)!;
    const colunas: { c: number; nome: string }[] = [];
    for (let c = 4; c <= ws.columnCount; c++) {
      if (String(valor(ws.getCell(1, c)) ?? "").trim() === "Pedido" && valor(ws.getCell(2, c))) colunas.push({ c, nome: String(valor(ws.getCell(2, c))).trim() });
    }
    for (let r = 6; r <= ws.rowCount; r++) {
      const bruto = valor(ws.getCell(r, 1));
      if (typeof bruto === "string" && bruto.trim().toLowerCase().startsWith("subtotal")) break;
      const itens: { nome: string; kg: number }[] = [];
      for (const { c, nome } of colunas) {
        const v = valor(ws.getCell(r, c));
        if (typeof v === "number" && v > 0) itens.push({ nome, kg: v });
      }
      if (!itens.length) continue;
      const codigo = codigoUnidade(bruto);
      if (!codigo) {
        res.semCodigo.push(`${modalidade}, linha ${r}: ${String(bruto)}`);
        continue;
      }
      for (const { nome, kg } of itens) {
        const nosso = nomeNosso(nome, nossos);
        if (!nosso) {
          res.foraDaLista[nome] = (res.foraDaLista[nome] ?? 0) + kg;
          continue;
        }
        res.linhas.push({ codigo, modalidade, produto: nosso, kg: Math.round(kg * 1e6) / 1e6 });
      }
    }
  }

  const tot = wb.getWorksheet("TOTAL");
  if (tot) {
    let linhaTotal = 0;
    for (let r = 1; r <= tot.rowCount; r++) if (String(valor(tot.getCell(r, 2)) ?? "").trim().toUpperCase() === "TOTAL=") linhaTotal = r;
    if (linhaTotal) {
      for (let c = 3; c <= tot.columnCount; c++) {
        if (String(valor(tot.getCell(3, c)) ?? "").trim() !== "Pedido") continue;
        const nome = String(valor(tot.getCell(4, c)) ?? "").trim();
        const v = valor(tot.getCell(linhaTotal, c));
        const nosso = nome ? nomeNosso(nome, nossos) : null;
        if (nosso && typeof v === "number" && v > 0) res.totalPrefeitura[nosso] = (res.totalPrefeitura[nosso] ?? 0) + v;
      }
    }
  }
  return res;
}

// Conferência da Prefeitura (formato de 20/10/2026): linha de cabeçalho com
// "GÊNEROS" e "TOTAL ENTREGUE (kg)"; produto na coluna B ("Alface - kg").
export async function lerConferencia(arquivo: ArrayBuffer | Buffer | string, nossos: string[]): Promise<{ entregue: Record<string, number>; foraDaLista: string[] }> {
  const wb = new ExcelJS.Workbook();
  if (typeof arquivo === "string") await wb.xlsx.readFile(arquivo);
  else await wb.xlsx.load(arquivo as ArrayBuffer);
  for (const ws of wb.worksheets) {
    let cab = 0;
    let colTotal = 0;
    let colNome = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 40) && !cab; r++) {
      for (let c = 1; c <= ws.columnCount; c++) {
        const t = chave(String(valor(ws.getCell(r, c)) ?? ""));
        if (t.startsWith("total entregue")) colTotal = c;
        if (t === "generos") colNome = c;
      }
      if (colTotal && colNome) cab = r;
      else colTotal = colNome = 0;
    }
    if (!cab) continue;
    const entregue: Record<string, number> = {};
    const foraDaLista: string[] = [];
    for (let r = cab + 1; r <= ws.rowCount; r++) {
      // O nome pode estar na coluna do cabeçalho ou na seguinte (célula mesclada).
      const nomeBruto = [colNome, colNome + 1].map((c) => valor(ws.getCell(r, c))).find((v) => typeof v === "string" && v.trim());
      const v = valor(ws.getCell(r, colTotal));
      if (typeof nomeBruto !== "string") continue;
      const nome = nomeBruto.replace(/\s*-\s*(kg|dz|unidade|un)\s*$/i, "").trim();
      const nosso = nomeNosso(nome, nossos);
      if (!nosso) {
        if (typeof v === "number" && v > 0) foraDaLista.push(nome);
        continue;
      }
      if (typeof v === "number") entregue[nosso] = (entregue[nosso] ?? 0) + Math.round(v * 1e6) / 1e6;
    }
    return { entregue, foraDaLista };
  }
  throw new Error('Não achei a tabela da conferência (coluna "TOTAL ENTREGUE (kg)").');
}
