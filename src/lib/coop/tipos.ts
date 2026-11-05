// Tipos do app da Cooperativa, espelhando a planilha MODELO v100 (contas da v99 + regra das folhas).
// Tudo é guardado em arquivos JSON (um cadastro + um arquivo por semana).

export type DiaRota = "SEG" | "TER"; // SEG = rotas do 1º dia de entrega das escolas; TER = do 2º

export interface Produto {
  nome: string; // como na planilha ("Alface lisa", "Ovos (dz)")
  preco: number; // preço de venda à Prefeitura
  unidade: "kg" | "dz";
  // Folhas: o produtor traz em 2 dias (parte das rotas de segunda no 1º dia,
  // parte das de terça no 2º). Os outros vêm todos no 1º dia.
  doisDias: boolean;
}

export interface Produtor {
  id: string; // nome da aba na planilha ("PROD - Ana C. C. R. Souza")
  nome: string; // nome completo
  curto: string; // como é chamado ("Ana")
  telefone: string | null;
}

export interface Escola {
  codigo: string; // como na planilha da Prefeitura ("1001", "1033.2")
  nome: string;
  aba: string; // nome da aba da ficha na planilha
  bairro: string;
  endereco: string;
  telefone: string;
}

export interface Parada {
  codigo: string;
  par: string; // nº da parada ("1", "4")
  sub: string; // "A"/"B" quando duas escolas dividem o endereço
  nomeMapa: string; // nome curto usado no mapa
  bairro: string;
}

export interface Rota {
  id: string; // "SEG-1", "SEG-MOTOBOY", "TER-4"
  dia: DiaRota;
  titulo: string; // "SEGUNDA-FEIRA — ROTA 1 · CAMINHÃO — CENTRO · MOTORISTA JORGE · 27 escolas"
  saida: string;
  paradas: Parada[];
}

export interface Motivo {
  codigo: string;
  texto: string;
}

export interface Cadastro {
  chamada: string; // "01/2026"
  processo: string; // "Proc. 6040/2026"
  taxaLogistica: number; // 3,67 por kg
  produtos: Produto[]; // na ordem da planilha (19)
  produtores: Produtor[]; // na ordem da planilha (22)
  escolas: Escola[]; // na ordem da Entrada de Dados (200)
  rotas: Rota[]; // ordem do mapa: segunda R1..R4, motoboy, terça R1..R4
  // Mapa de Produção: kg por mês (índice 0 = outubro … 11 = setembro).
  capacidade: Record<string, Record<string, number[]>>; // produto → produtor → 12 meses
  motivos: Motivo[];
  pesoCaixa: { grande: number; pequena: number };
}

export type PorProdutorProduto = Record<string, Record<string, number>>; // produtor → produto → kg

export interface RetornoEscola {
  recebido?: number; // só quando diferente do que saiu no caminhão
  rejeitado?: number;
  motivo?: string; // código do motivo
  situacao?: string; // "Encerrada sem atendimento"
}

export interface Custos {
  transporte: number;
  montagem: number;
  administrativo: number; // valor já pago
  administrativoFalta: number; // só informação ("falta pagar")
  embalagens: number;
  escritorio: number;
  impostos: number;
  contabilidade: number;
  conselho: number;
}

export interface Semana {
  data: string; // "2026-10-26" (data de referência)
  referencia: string; // "26/10/2026"
  entrega: number; // nº da entrega
  chamada: string;
  processo: string;
  diasGalpao: [string, string]; // ["DOMINGO", "SEGUNDA"] (feriado: ["SEGUNDA", "TERÇA"])
  // Corte combinado com a nutricionista: o que entra é o pedido já cortado.
  pedidoEscolas: Record<string, Record<string, number>>; // código → produto → kg
  pedidoPrefeituraOriginal?: Record<string, Record<string, number>>; // como veio, antes do corte
  capacidadeSemana: Record<string, Record<string, number>>; // "SÓ ESTA SEMANA" do Mapa de Produção
  pedidoProdutorManual: PorProdutorProduto; // ajustes do Paulo (por cima da divisão)
  entrega1: PorProdutorProduto; // ausente = ainda não lançado (vale o planejado)
  entrega2: PorProdutorProduto;
  extra: PorProdutorProduto;
  retornos: Record<string, Record<string, RetornoEscola>>; // código → produto
  conferidoPrefeitura: Record<string, number>; // produto → kg
  romaneiosConferidos: boolean;
  custos: Custos;
  rotas: Rota[]; // cópia das rotas no momento (mudam de uma semana para outra)
  // Regra da linha 11 da aba _ENTREGA: a semana 26/10 corrigiu (produto que
  // não é folha não pede nada no 2º dia). O app usa a corrigida.
  regraPrimeiroDia: "corrigida" | "modelo";
  // MODELO v100 (04/11/2026): folha não dorme no galpão. Nas rotas de terça a
  // folha usa só o que chegou no 2º dia (_ENTREGA linha 13). Ausente = regra antiga (v99).
  folhaSoNoDia?: boolean;
  atualizadoEm?: string;
  mensagensEnviadas?: Record<string, string>; // produtor → data/hora em que o botão foi usado
}
