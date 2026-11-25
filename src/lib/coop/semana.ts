// Criar uma semana nova e saber em que pé ela está (a "listinha").

import { custoDaEscala, escalaDe } from "./escala";
import type { ResultadoSemana } from "./motor";
import type { Cadastro, Custos, Semana } from "./tipos";

export const CUSTOS_ZERADOS: Custos = {
  transporte: 0,
  montagem: 0,
  administrativo: 0,
  administrativoFalta: 0,
  embalagens: 0,
  escritorio: 0,
  impostos: 0,
  contabilidade: 0,
  conselho: 0,
};

export const NOMES_CUSTOS: [keyof Custos, string][] = [
  ["transporte", "Transporte (frete)"],
  ["montagem", "Montagem"],
  ["administrativo", "Administrativo (pago na semana)"],
  ["embalagens", "Embalagens + material de limpeza"],
  ["escritorio", "Material de escritório"],
  ["impostos", "Impostos"],
  ["contabilidade", "Serviço de contabilidade"],
  ["conselho", "Ajuda de custo do conselho"],
];

const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const numDia = (nome: string) => DIAS_SEMANA.indexOf(nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/-feira.*/, "").trim().split(" ")[0]);
const somarDiasData = (data: string, n: number) => new Date(Date.parse(`${data}T12:00:00Z`) + n * 86400000);
const br = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

// Datas dos dias do galpão da semana: ex. semana 30/11 (segunda), galpão domingo e segunda → 29/11 e 30/11.
export function datasDoGalpao(sem: Pick<Semana, "data" | "diasGalpao">): [string, string] {
  const [a, b] = sem.diasGalpao.map(numDia);
  let d2 = 0;
  while (d2 > -7 && somarDiasData(sem.data, d2).getUTCDay() !== b) d2--;
  let d1 = d2 - 1;
  while (d1 > d2 - 7 && somarDiasData(sem.data, d1).getUTCDay() !== a) d1--;
  return [br(somarDiasData(sem.data, d1)), br(somarDiasData(sem.data, d2))];
}

// Data da entrega nas escolas de uma rota ("SEGUNDA-FEIRA — ROTA 1" → a segunda da semana).
export function dataDaRota(sem: Pick<Semana, "data">, tituloRota: string): string | null {
  const alvo = numDia(tituloRota);
  if (alvo < 0) return null;
  for (let n = 0; n < 7; n++) if (somarDiasData(sem.data, n).getUTCDay() === alvo) return br(somarDiasData(sem.data, n));
  return null;
}

export function referenciaDeData(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function curta(data: string): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

export function novaSemana(
  cad: Cadastro,
  p: {
    data: string;
    entrega: number;
    diasGalpao: [string, string];
    pedidoEscolas: Semana["pedidoEscolas"];
    pedidoPrefeituraOriginal: Semana["pedidoPrefeituraOriginal"];
    custosAnteriores?: Custos;
  },
): Semana {
  return {
    data: p.data,
    referencia: referenciaDeData(p.data),
    entrega: p.entrega,
    chamada: cad.chamada,
    processo: cad.processo,
    diasGalpao: p.diasGalpao,
    pedidoEscolas: p.pedidoEscolas,
    pedidoPrefeituraOriginal: p.pedidoPrefeituraOriginal,
    capacidadeSemana: {},
    pedidoProdutorManual: {},
    entrega1: {},
    entrega2: {},
    extra: {},
    retornos: {},
    conferidoPrefeitura: {},
    romaneiosConferidos: false,
    // Custos já vêm com os da semana anterior: só muda o que mudou.
    // Montagem = diárias da escala do galpão (ex.: 7 × R$ 150 = R$ 1.050).
    custos: { ...(p.custosAnteriores ?? CUSTOS_ZERADOS), montagem: custoDaEscala(escalaDe(cad)) },
    rotas: structuredClone(cad.rotas),
    regraPrimeiroDia: "corrigida",
    folhaSoNoDia: true, // MODELO v100
    excedenteRestoUltima: true, // MODELO v103
    mensagensEnviadas: {},
  };
}

export interface ItemListinha {
  chave: string;
  texto: string;
  feito: boolean;
  detalhe?: string;
}

export function listinha(cad: Cadastro, sem: Semana, r: ResultadoSemana): ItemListinha[] {
  const comPedido = cad.produtores.filter((p) => Object.values(r.pedidoProdutor[p.id]).some((v) => v > 0));
  const enviadas = comPedido.filter((p) => sem.mensagensEnviadas?.[p.id]).length;
  const dia1 = comPedido.filter((p) => cad.produtos.some((pr) => r.produtores[p.id][pr.nome].planejado1 > 0.004));
  const dia2 = comPedido.filter((p) => cad.produtos.some((pr) => r.produtores[p.id][pr.nome].planejado2 > 0.004));
  const lancado = (m: Semana["entrega1"], ids: string[]) => ids.filter((id) => m[id] && Object.keys(m[id]).length > 0).length;
  const custos = Object.entries(sem.custos).some(([k, v]) => k !== "administrativoFalta" && v > 0);
  return [
    { chave: "pedido", texto: "Pedido da Prefeitura lançado", feito: r.resumo.pedidoTotal > 0 },
    { chave: "mensagens", texto: "Pedido enviado aos produtores", feito: comPedido.length > 0 && enviadas === comPedido.length, detalhe: `${enviadas} de ${comPedido.length}` },
    {
      chave: "dia1",
      texto: `Entregas do ${sem.diasGalpao[0].toLowerCase()} lançadas`,
      feito: dia1.length > 0 && lancado(sem.entrega1, dia1.map((p) => p.id)) === dia1.length,
      detalhe: `${lancado(sem.entrega1, dia1.map((p) => p.id))} de ${dia1.length} produtores`,
    },
    {
      chave: "dia2",
      texto: `Entregas da ${sem.diasGalpao[1].toLowerCase()} lançadas`,
      feito: dia2.length === 0 || lancado(sem.entrega2, dia2.map((p) => p.id)) === dia2.length,
      detalhe: `${lancado(sem.entrega2, dia2.map((p) => p.id))} de ${dia2.length} produtores`,
    },
    { chave: "retornos", texto: "Romaneios das escolas conferidos", feito: sem.romaneiosConferidos },
    { chave: "prefeitura", texto: "Conferência da Prefeitura (se vier)", feito: Object.keys(sem.conferidoPrefeitura).length > 0 },
    { chave: "custos", texto: "Custos da semana", feito: custos },
  ];
}
