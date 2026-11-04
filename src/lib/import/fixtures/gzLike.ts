// Reprodução sintética da ESTRUTURA da planilha GZ (anexo do prompt v2,
// "Planilha_de_Pedido_22-06-2026_-_GZ_Alimentos.xlsx", que não é versionada):
// abas "Modalidade - …" com linha 1 = Pedido/Entrega e linha 2 = produtos,
// código na coluna A (cabeçalho "ESCOLA"), nome na B, "Número de
// Atendimentos" na C, linhas de parâmetro antes dos dados e subtotal no fim;
// aba TOTAL só com subtotais; aba antiga oculta. Números fictícios.

import type { CatalogProduct, CatalogSchool, RawCell, RawSheet, RawWorkbook } from "../types";

export const n = (v: number): RawCell => ({ t: "number", v });
export const s = (v: string): RawCell => ({ t: "text", v });
export const E: RawCell = { t: "empty" };
export const noResult: RawCell = { t: "formula_no_result", f: "(C6*X$5*X$3)" };

export const products: CatalogProduct[] = [
  { id: "p-abacate", slug: "abacate", name: "Abacate", unit: "kg", offered: true },
  { id: "p-alface", slug: "alface-lisa", name: "Alface lisa", unit: "kg", offered: true },
  { id: "p-couve", slug: "couve-manteiga", name: "Couve manteiga", unit: "kg", offered: true },
  { id: "p-couveflor", slug: "couve-flor", name: "Couve-flor", unit: "kg", offered: true },
  { id: "p-cheiro", slug: "cheiro-verde", name: "Cheiro verde", unit: "kg", offered: true },
  { id: "p-ovos", slug: "ovos", name: "Ovos", unit: "dz", offered: false },
];

export const schools: CatalogSchool[] = [
  { id: "s-1001", code: "1001", name: "ESCOLA MUNICIPAL ABELARDO DE LAMARE" },
  { id: "s-1003", code: "1003", name: "E.M. BATAILLARD" },
  { id: "s-1096", code: "1096", name: "ESCOLA MUNICIPAL MONSENHOR CIRILLO CALAON" },
  { id: "s-2044", code: "2044", name: "ESCOLA SANTO ANTÔNIO" },
  { id: "s-3016", code: "3016", name: "CEI PEDRAS BRANCAS" },
];

// Colunas: A código | B nome | C atendimentos | D/E Abacate | F/G Alface |
// H/I Cheiro-verde | J/K Ovo | L/M Abacaxi
const HEADER_1 = [E, E, s("Atualização 12/04/2022"), s("Pedido"), s("Entrega"), s("Pedido"), s("Entrega"), s("Pedido"), s("Entrega"), s("Pedido"), s("Entrega"), s("Pedido"), s("Entrega")];
const HEADER_2 = [s("ESCOLA"), s("ESCOLA"), s("Número de Atendimentos"), s("Abacate"), s("Abacate"), s("Alface"), s("Alface"), s("Cheiro-verde"), s("Cheiro-verde"), s("Ovo"), s("Ovo"), s("Abacaxi"), s("Abacaxi")];
const PARAMS = [
  [E, E, E, n(0.8), E, n(1), E, n(5), E, n(1), E, n(1)],
  [E],
  [s("PC 2020"), s("PC 2020"), E, n(0.05), E, n(0.01), E, n(0.0006), E, n(0.1), E, n(0.1)],
];

export function modalitySheet(name: string, dataRows: RawCell[][], hidden = false): RawSheet {
  return {
    name,
    hidden,
    rows: [HEADER_1, HEADER_2, ...PARAMS, ...dataRows, [s("Subtotal Escolas ="), s("Subtotal Escolas ="), E, n(999), n(999)]],
  };
}

// Linha de escola: pedido e entrega (a entrega NUNCA deve ser importada).
export function schoolRow(code: RawCell, name: string, abacate: RawCell, alface: RawCell = E, cheiro: RawCell = E, ovo: RawCell = E): RawCell[] {
  const entrega = (c: RawCell) => (c.t === "number" ? n(c.v + 1000) : c);
  return [code, s(name), n(200), abacate, entrega(abacate), alface, entrega(alface), cheiro, entrega(cheiro), ovo, entrega(ovo), n(3), n(3)];
}

export function gzLikeWorkbook(): RawWorkbook {
  return {
    fileName: "gz-sintetico.xlsx",
    source: "xlsx",
    sheets: [
      modalitySheet("Modalidade - UE", [
        schoolRow(n(1001), "ESCOLA MUNICIPAL ABELARDO DE LAMARE", n(8), n(2), n(1.7999999999999998), n(12)),
        schoolRow(n(1003), "ESCOLA MUNICIPAL BATAILLARD", n(10), n(2.5), n(0.75)),
        [s("GAE"), s("GERÊNCIA DE ALIMENTAÇÃO ESCOLAR")],
      ]),
      modalitySheet("Modalidade - UE Integral", [
        schoolRow(n(2044), "ESCOLA DE EDUCAÇÃO INTEGRAL PADRE QUINHA", n(4)),
        schoolRow(n(1096.1), "ESCOLA MUNICIPAL MONSENHOR CIRILLO CALAON", n(3)),
      ]),
      modalitySheet("Modalidade - CEI", [
        schoolRow(n(3016), "CEI SOROPTIMISTA", n(7.568), noResult),
        schoolRow({ t: "date", v: "2033-02-01" }, "COLÉGIO ANGLICANO DE ARARAS 2", n(1)),
      ]),
      {
        name: "TOTAL",
        hidden: false,
        rows: [[E], [E], [E, E, s("Pedido"), s("Entrega")], [E, E, s("Abacate"), s("Abacate")], [E, s("Subtotal Escolas ="), n(830.7), n(830.7)]],
      },
      modalitySheet("UE", [schoolRow(n(1001), "ESCOLA MUNICIPAL ABELARDO DE LAMARE", n(99))], true),
      { name: "CEI", hidden: true, rows: [] },
    ],
  };
}
