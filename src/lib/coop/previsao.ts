// Previsão de produção: entende as respostas do WhatsApp ("2mil kg xuxu",
// "30klcouve 75klalface") e monta a tabela para a nutricionista.
// Sempre mostra o que entendeu para o João confirmar antes de gravar.

export interface ItemPrevisao {
  produtor: string; // id do produtor (aba PROD)
  produto: string;
  kg: number;
}

export interface Previsao {
  data: string; // data da entrega (aaaa-mm-dd)
  itens: ItemPrevisao[];
  semProducao: string[]; // produtores que disseram que não vão ter
  observacoes: string[];
  respostas: Record<string, string>; // produtor → texto colado
}

export interface ItemEntendido {
  produto: string;
  kg: number;
  trecho: string;
}

function semAcento(t: string): string {
  return t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Nomes populares → nome da planilha. A ordem importa: "couve flor" antes de "couve".
const APELIDOS: [RegExp, string][] = [
  [/couve[\s-]*flor/, "Couve-flor"],
  [/cheiro[\s-]*verde|cheiro|salsinha|cebolinha/, "Cheiro verde"],
  [/couve/, "Couve manteiga"],
  [/alface/, "Alface lisa"],
  [/xuxu|chuchu/, "Chuchu"],
  [/beterraba|beterava/, "Beterraba"],
  [/abobrinha|abobora/, "Abobrinha"],
  [/repolho/, "Repolho"],
  [/espinafre/, "Espinafre"],
  [/agriao/, "Agrião"],
  [/brocolis|brocoli/, "Brócolis"],
  [/cenoura/, "Cenoura"],
  [/abacate/, "Abacate"],
  [/banana/, "Banana prata"],
  [/batata/, "Batata inglesa"],
  [/maca/, "Maçã gala"],
  [/tangerina|ponkan|mexerica/, "Tangerina ponkan"],
  [/ovo/, "Ovos (dz)"],
  [/\bmel\b/, "Mel"],
];

export function produtoDoTexto(trecho: string, produtosValidos: string[]): string | null {
  const t = semAcento(trecho);
  for (const [re, nome] of APELIDOS) if (re.test(t) && produtosValidos.includes(nome)) return nome;
  for (const nome of produtosValidos) if (t.includes(semAcento(nome))) return nome;
  return null;
}

export function semProducao(texto: string): boolean {
  const t = semAcento(texto);
  return /n[a]o (vai |vou )?(ter|tenho)|sem produc|nao tem produc|so (no )?ano que vem/.test(t);
}

const NUMERO = /(\d+(?:[.,]\d+)?)\s*(mil)?\s*(kgs?|kilos?|quilos?|kls?|k\b)?/g;

// Lê "200 kilo beterraba 100 kilo de couve" ou "30klcouve 75klalface" ou
// "couve 50kg". Quando o mesmo produto aparece de novo (domingo e segunda),
// soma.
export function entenderResposta(texto: string, produtosValidos: string[]): ItemEntendido[] {
  const limpo = semAcento(texto).replace(/(\d)\s*mil\b/g, "$1mil");
  const achados: { pos: number; fim: number; kg: number }[] = [];
  for (const m of limpo.matchAll(NUMERO)) {
    const temUnidade = Boolean(m[3]) || Boolean(m[2]);
    let kg = Number(m[1].replace(",", "."));
    if (m[2]) kg *= 1000;
    // Número sem unidade (ex.: datas "08/11", "segunda 2") só conta se vier colado a um produto.
    achados.push({ pos: m.index ?? 0, fim: (m.index ?? 0) + m[0].length, kg: temUnidade ? kg : -kg });
  }
  const itens: ItemEntendido[] = [];
  achados.forEach((a, i) => {
    const depois = limpo.slice(a.fim, i + 1 < achados.length ? achados[i + 1].pos : limpo.length);
    const antes = limpo.slice(i > 0 ? achados[i - 1].fim : 0, a.pos);
    let produto = produtoDoTexto(depois.split(/[,;.\n/]| e /)[0] ?? "", produtosValidos);
    if (!produto) produto = produtoDoTexto(antes.split(/[,;.\n/]| e /).pop() ?? "", produtosValidos);
    if (!produto) return;
    const kg = Math.abs(a.kg);
    if (a.kg < 0 && !/^\s*(de\s+)?[a-z]/.test(depois)) return;
    itens.push({ produto, kg, trecho: texto.slice(Math.max(0, a.pos - 2), Math.min(texto.length, a.fim + 18)).trim() });
  });
  const somado = new Map<string, ItemEntendido>();
  for (const it of itens) {
    const ja = somado.get(it.produto);
    if (ja) somado.set(it.produto, { ...ja, kg: ja.kg + it.kg, trecho: `${ja.trecho} + ${it.trecho}` });
    else somado.set(it.produto, { ...it });
  }
  return [...somado.values()];
}

export function totaisPrevisao(p: Previsao, ordemProdutos: string[]) {
  const porProduto = new Map<string, number>();
  for (const it of p.itens) porProduto.set(it.produto, (porProduto.get(it.produto) ?? 0) + it.kg);
  const lista = [...porProduto.entries()].sort((a, b) => b[1] - a[1] || ordemProdutos.indexOf(a[0]) - ordemProdutos.indexOf(b[0]));
  return { porProduto: lista, total: lista.reduce((s, [, kg]) => s + kg, 0) };
}
