// Lê a planilha da Cooperativa (MODELO v99/v100 ou uma semana controle_...xlsx)
// e devolve o cadastro e o que foi digitado na semana. Só leitura: nada é
// gravado na planilha.

import ExcelJS from "exceljs";
import type { Cadastro, Custos, DiaRota, Escola, Parada, PorProdutorProduto, Produto, Produtor, RetornoEscola, Rota, Semana } from "../tipos";

type Cel = ExcelJS.Cell;

function formula(c: Cel): string | null {
  return typeof c.formula === "string" ? c.formula : null;
}

// Valor digitado (não fórmula): número, texto ou null.
function digitado(c: Cel): number | string | null {
  if (formula(c)) return null;
  const v = c.value;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  return null;
}

function numero(c: Cel): number | undefined {
  const v = digitado(c);
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(",", "."));
  return undefined;
}

function texto(c: Cel): string {
  const v = digitado(c);
  return v === null ? "" : String(v).trim();
}

export function codigoTexto(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v ?? "").trim();
}

function abaDaFormula(f: string | null): string | null {
  if (!f) return null;
  const m = /^'?(.+?)'?!\$?B\$?5$/.exec(f.trim()) ?? /#'(.+?)'!A1/.exec(f);
  return m ? m[1] : null;
}

const CABECALHO_ROTA = /^(SEGUNDA|TERÇA)-FEIRA — (.+)$/;

export interface PlanilhaLida {
  cadastro: Cadastro;
  semana: Semana;
  avisos: string[];
}

export async function lerPlanilha(arquivo: string | Buffer | ArrayBuffer): Promise<PlanilhaLida> {
  const wb = new ExcelJS.Workbook();
  if (typeof arquivo === "string") await wb.xlsx.readFile(arquivo);
  else await wb.xlsx.load(arquivo as ArrayBuffer);
  const avisos: string[] = [];
  const aba = (nome: string) => {
    const ws = wb.getWorksheet(nome);
    if (!ws) throw new Error(`A planilha não tem a aba "${nome}". Use o MODELO (v100) ou uma semana feita a partir dele.`);
    return ws;
  };
  const ent = aba("Entrada de Dados");
  const indice = aba("ÍNDICE");

  // Produtos (Entrada de Dados, linha 5 e preços na linha 2).
  const primeiraProd = wb.worksheets.find((w) => w.name.startsWith("PROD - "));
  if (!primeiraProd) throw new Error("A planilha não tem as abas dos produtores (PROD - …).");
  const produtos: Produto[] = [];
  for (let c = 3; c <= 21; c++) {
    const nome = texto(ent.getCell(5, c)) || String(ent.getCell(5, c).value ?? "");
    const precoV = ent.getCell(2, c).value;
    const t = formula(primeiraProd.getCell(6 + (c - 3), 20)) ?? "";
    produtos.push({
      nome,
      preco: typeof precoV === "number" ? precoV : Number(precoV),
      unidade: /\(dz\)/i.test(nome) ? "dz" : "kg",
      doisDias: t.includes("_AUX_DIVISAO"),
    });
  }

  // Produtores (Entrada de Dados 210–231 apontam para as abas PROD).
  const produtores: Produtor[] = [];
  for (let r = 210; r <= 231; r++) {
    const id = abaDaFormula(formula(ent.getCell(r, 2)));
    if (!id) throw new Error(`Entrada de Dados B${r} não aponta para a aba de um produtor.`);
    const ws = aba(id);
    const nome = texto(ws.getCell("B2"));
    const fTel = formula(ws.getCell("B3")) ?? "";
    const linhaTel = /\$B\$(\d+)/.exec(fTel)?.[1];
    const tel = linhaTel ? texto(indice.getCell(Number(linhaTel), 2)) : texto(ws.getCell("B3"));
    produtores.push({ id, nome, curto: nome.split(/\s+/)[0] ?? nome, telefone: tel || null });
  }

  // Escolas (Entrada de Dados 6–205 apontam para as fichas).
  const escolas: Escola[] = [];
  const linhaEscola: { codigo: string; linha: number; aba: string }[] = [];
  for (let r = 6; r <= 205; r++) {
    const nomeAba = abaDaFormula(formula(ent.getCell(r, 1)));
    if (!nomeAba) throw new Error(`Entrada de Dados A${r} não aponta para a ficha de uma escola.`);
    const ws = aba(nomeAba);
    const codigo = codigoTexto(ws.getCell("B5").value);
    escolas.push({
      codigo,
      nome: texto(ws.getCell("B2")),
      aba: nomeAba,
      bairro: texto(ws.getCell("B3")),
      endereco: texto(ws.getCell("B4")),
      telefone: texto(ws.getCell("B6")),
    });
    linhaEscola.push({ codigo, linha: r, aba: nomeAba });
  }

  // Rotas (aba _MAPA, na ordem do mapa de montagem).
  const mapa = aba("_MAPA");
  const rotas: Rota[] = [];
  let atual: Rota | null = null;
  for (let r = 1; r <= mapa.rowCount; r++) {
    const a = texto(mapa.getCell(r, 1));
    const cab = CABECALHO_ROTA.exec(a);
    if (cab) {
      const dia: DiaRota = cab[1] === "SEGUNDA" ? "SEG" : "TER";
      const num = /ROTA (\d+)/.exec(a)?.[1];
      atual = { id: `${dia}-${num ?? (/MOTOBOY/.test(a) ? "MOTOBOY" : rotas.length + 1)}`, dia, titulo: a, saida: "", paradas: [] };
      rotas.push(atual);
      continue;
    }
    if (!atual) continue;
    if (/^Saída:|^MOTOBOY:/.test(a)) {
      atual.saida = a;
      continue;
    }
    const codigo = codigoTexto(mapa.getCell(r, 3).value);
    if (!codigo || codigo === "CÓDIGO" || !/^\d/.test(codigo)) continue;
    const fNome = formula(mapa.getCell(r, 4)) ?? "";
    const nomeMapa = /,"(.*)"\)\s*$/.exec(fNome)?.[1] ?? texto(mapa.getCell(r, 4));
    const y = texto(mapa.getCell(r, 25));
    if (y && y !== atual.dia) avisos.push(`_MAPA linha ${r}: escola ${codigo} marcada ${y} dentro de uma rota de ${atual.dia}.`);
    const parada: Parada = {
      codigo,
      par: codigoTexto(mapa.getCell(r, 1).value),
      sub: texto(mapa.getCell(r, 2)),
      nomeMapa,
      bairro: texto(mapa.getCell(r, 5)),
    };
    atual.paradas.push(parada);
  }

  // Mapa de Produção: qual linha vale para cada produto × produtor (_AUX_DIVISAO, coluna C).
  const aux = aba("_AUX_DIVISAO");
  const mp = aba("MAPA DE PRODUÇÃO");
  const capacidade: Cadastro["capacidade"] = {};
  const capacidadeSemana: Semana["capacidadeSemana"] = {};
  produtos.forEach((p, i) => {
    capacidade[p.nome] = {};
    produtores.forEach((prod, j) => {
      const f = formula(aux.getCell(4 + 24 * i + j, 3));
      const linha = f ? /\$O\$(\d+)/.exec(f)?.[1] : null;
      if (!linha) return;
      const meses = Array.from({ length: 12 }, (_, m) => Number(mp.getCell(Number(linha), 2 + m).value ?? 0) || 0);
      capacidade[p.nome][prod.id] = meses;
      const s = numero(mp.getCell(Number(linha), 15));
      if (s !== undefined) (capacidadeSemana[p.nome] ??= {})[prod.id] = s;
    });
  });

  const motivosAba = aba("MOTIVO");
  const motivos = [];
  for (let r = 4; r <= 30; r++) {
    const codigo = codigoTexto(motivosAba.getCell(r, 1).value);
    const t = texto(motivosAba.getCell(r, 2));
    if (codigo && t) motivos.push({ codigo, texto: t });
  }

  const cadastro: Cadastro = {
    chamada: texto(indice.getCell("E5")),
    processo: texto(indice.getCell("E6")),
    taxaLogistica: 3.67,
    produtos,
    produtores,
    escolas,
    rotas,
    capacidade,
    motivos,
    pesoCaixa: { grande: 4, pequena: 2 },
  };

  // ---- O que foi digitado na semana ----
  const pedidoEscolas: Semana["pedidoEscolas"] = {};
  for (const { codigo, linha } of linhaEscola) {
    produtos.forEach((p, i) => {
      const v = numero(ent.getCell(linha, 3 + i));
      if (v !== undefined && v !== 0) (pedidoEscolas[codigo] ??= {})[p.nome] = v;
    });
  }
  const bloco = (inicio: number, contarVazioComoZero: boolean): PorProdutorProduto => {
    const m: PorProdutorProduto = {};
    produtores.forEach((prod, j) => {
      produtos.forEach((p, i) => {
        const c = ent.getCell(inicio + j, 3 + i);
        if (formula(c)) return;
        const v = numero(c);
        if (v !== undefined) (m[prod.id] ??= {})[p.nome] = v;
        else if (contarVazioComoZero) (m[prod.id] ??= {})[p.nome] = 0;
      });
    });
    return m;
  };

  const retornos: Semana["retornos"] = {};
  for (const e of escolas) {
    const ws = aba(e.aba);
    produtos.forEach((p, i) => {
      const r = 9 + i;
      if (texto(ws.getCell(r, 1)) && texto(ws.getCell(r, 1)) !== p.nome) {
        avisos.push(`Ficha ${e.aba}: linha ${r} é "${texto(ws.getCell(r, 1))}", esperado "${p.nome}".`);
      }
      const item: RetornoEscola = {};
      const rec = numero(ws.getCell(r, 3));
      const rej = numero(ws.getCell(r, 4));
      const mot = texto(ws.getCell(r, 9));
      const sit = texto(ws.getCell(r, 12));
      if (rec !== undefined) item.recebido = rec;
      if (rej !== undefined) item.rejeitado = rej;
      if (mot) item.motivo = mot;
      if (sit) item.situacao = sit;
      if (Object.keys(item).length) (retornos[e.codigo] ??= {})[p.nome] = item;
    });
  }

  const resumo = aba("RESUMO");
  const conferidoPrefeitura: Record<string, number> = {};
  produtos.forEach((p, i) => {
    const v = numero(resumo.getCell(29 + i, 7));
    if (v !== undefined) conferidoPrefeitura[p.nome] = v;
  });

  const bal = aba("BALANÇO FINANCEIRO");
  const custo = (a: string) => numero(bal.getCell(a)) ?? 0;
  const custos: Custos = {
    transporte: custo("D11"),
    montagem: custo("D12"),
    administrativo: custo("D13"),
    administrativoFalta: custo("E13"),
    embalagens: custo("D14"),
    escritorio: custo("D15"),
    impostos: custo("D16"),
    contabilidade: custo("D17"),
    conselho: custo("D18"),
  };

  const dRaw = indice.getCell("D2").value;
  const referencia =
    dRaw instanceof Date
      ? `${String(dRaw.getUTCDate()).padStart(2, "0")}/${String(dRaw.getUTCMonth() + 1).padStart(2, "0")}/${dRaw.getUTCFullYear()}`
      : texto(indice.getCell("D2"));
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(referencia);
  const msg = formula(primeiraProd.getCell("A28")) ?? "";
  const dias = [...msg.matchAll(/Entregar n[oa] ([^:*]+):/g)].map((x) => x[1].trim());
  const f11 = formula(aba("_ENTREGA").getCell("C11")) ?? "";
  const f13 = formula(aba("_ENTREGA").getCell("C13")) ?? "";

  const semana: Semana = {
    data: m ? `${m[3]}-${m[2]}-${m[1]}` : "",
    referencia,
    entrega: Number(indice.getCell("E4").value) || 0,
    chamada: cadastro.chamada,
    processo: cadastro.processo,
    diasGalpao: [dias[0] ?? "DOMINGO", dias[1] ?? "SEGUNDA"],
    pedidoEscolas,
    capacidadeSemana,
    pedidoProdutorManual: bloco(210, true),
    entrega1: bloco(236, false),
    entrega2: bloco(261, false),
    extra: bloco(293, false),
    retornos,
    conferidoPrefeitura,
    romaneiosConferidos: texto(indice.getCell("E7")).toUpperCase() === "SIM",
    custos,
    rotas,
    regraPrimeiroDia: f11.includes("MAX(0") ? "corrigida" : "modelo",
    folhaSoNoDia: /IF\(C6>0\.004,C8,/.test(f13.replace(/\s/g, "")),
  };
  return { cadastro, semana, avisos };
}
