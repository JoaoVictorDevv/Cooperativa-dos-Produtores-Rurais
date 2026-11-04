// Motor de cálculo da semana: reproduz as fórmulas da planilha MODELO v99.
// Cada bloco cita a aba e a linha de onde a regra vem, para conferir.
//
// Entradas: o cadastro e o que foi digitado na semana (tipos.ts).
// Saídas: divisão, planejado por dia, mapa de montagem, fichas das escolas,
// pagamento dos produtores, resumo e balanço.

import { arred, arredBaixo, soma } from "./numeros";
import type { Cadastro, DiaRota, PorProdutorProduto, Semana } from "./tipos";

const EPS = 0.000001;

export interface LinhaEntregaProduto {
  pedidoSeg: number; // _ENTREGA linha 3
  pedidoTer: number; // linha 4
  planejado1: number; // linha 5
  planejado2: number; // linha 6
  entregue1: number; // linha 7 (em branco = planejado)
  entregue2: number; // linha 8
  precisa1: number; // linha 11
  fator1: number; // linha 12
  disponivel2: number; // linha 13
  fator2: number; // linha 14
  faltaDividida: number; // linha 15
  planejadoNaoLancado: number; // linha 16
}

export interface FichaProduto {
  pedido: number;
  enviado: number; // o que o mapa mandou (Z)
  bruto: number | null; // recebido bruto considerado (V): digitado ou o enviado
  rejeitado: number;
  aceito: number; // E
  segundaViagem: number; // K (entrega extra)
  totalAceito: number; // M
  cobrado: number; // U = mín(total aceito, pedido)
  falta: number; // F
  excedente: number; // G
  faltouNoGalpao: boolean; // Y
  motivo?: string;
  situacao?: string;
}

export interface ProdutorProduto {
  pedido: number; // B
  planejado1: number; // T
  planejado2: number; // U
  entregue: number; // C (1º + 2º dia + extra, só o digitado)
  extra: number; // J
  extraPago: number; // X
  pagoKg: number; // K
  precoLiquido: number; // F
  valor: number; // G
  diferencaPedido: number; // D
}

export interface ResultadoSemana {
  mesIndice: number; // 1 = outubro … 12 = setembro (0 = sem data)
  divisaoCalculada: PorProdutorProduto; // _AUX_DIVISAO coluna Q
  faltaNaDivisao: Record<string, number>; // _AUX_DIVISAO coluna R
  pedidoProdutor: PorProdutorProduto; // Entrada de Dados 210–231 (com ajustes)
  diaEscola: Record<string, DiaRota>;
  entregaProduto: Record<string, LinhaEntregaProduto>;
  enviado: Record<string, Record<string, number>>; // mapa de montagem: escola → produto
  extraEscola: Record<string, Record<string, number>>;
  fichas: Record<string, Record<string, FichaProduto>>;
  produtores: Record<string, Record<string, ProdutorProduto>>;
  pagarProdutor: Record<string, number>;
  resumo: Resumo;
  balanco: Balanco;
}

export interface ResumoProduto {
  produto: string;
  pedido: number;
  cobradoKg: number;
  naoCobradoKg: number;
  valorCobrado: number;
  naoCobradoValor: number;
  conferido: number | null;
  rejeitadoEscola: number;
  entregueGalpao: number;
  pagoKg: number;
  sobraGalpao: number;
  valorPago: number;
  aceitoGalpao: number;
}

export interface Resumo {
  cobrar: number; // E3
  pagar: number; // E4
  margem: number; // E5
  taxaLogistica: number; // E21
  perdas: number | null; // E22 (null = aguardando conferência das escolas)
  perdasDepoisGalpao: number | null; // E23
  entregasLancadasKg: number; // E13
  pedidoTotal: number; // E15
  extrasPagos: number; // E11
  produtos: ResumoProduto[];
  totais: { pedido: number; cobradoKg: number; valorCobrado: number; entregueGalpao: number; pagoKg: number; valorPago: number };
}

export interface Balanco {
  cobrado: number;
  pago: number;
  perdas: number | null;
  margem: number;
  custos: number;
  saldo: number;
}

const n = (v: number | undefined | null) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const digitado = (m: PorProdutorProduto, produtor: string, produto: string): number | undefined => m[produtor]?.[produto];

// Mês da divisão: 1 = outubro … 12 = setembro (_AUX_DIVISAO!B1).
export function mesIndice(referencia: string): number {
  const m = /^\d{2}\/(\d{2})\/\d{4}$/.exec(referencia.trim());
  if (!m) return 0;
  return ((Number(m[1]) - 10 + 12) % 12) + 1;
}

// _AUX_DIVISAO: divide o pedido de um produto igualmente entre quem tem
// produção no mês, sem passar da produção de cada um. O que sobra de
// arredondamento vai para o de maior produção.
export function dividirProduto(pedido: number, capacidades: number[]): number[] {
  const total = capacidades.length;
  const comProducao = capacidades.filter((c) => c > 0).length;
  const ordenadas = [...capacidades].sort((a, b) => a - b);
  const sem = total - comProducao;
  let nivel = 0;
  if (comProducao > 0) {
    nivel = Math.max(...capacidades);
    let acumulado = 0;
    for (let d = 1; d <= comProducao; d++) {
      const e = ordenadas[sem + d - 1];
      const g = (pedido - acumulado) / (comProducao - d + 1);
      if (g <= e + EPS) {
        nivel = g;
        break;
      }
      acumulado += e;
    }
  }
  const base = capacidades.map((c) => (c > 0 ? arred(Math.min(c, nivel)) : 0));
  const atendivel = Math.min(pedido, soma(capacidades));
  const maior = capacidades.indexOf(Math.max(...capacidades));
  const somaBase = soma(base);
  return base.map((v, i) => arred(v + (i === maior ? atendivel - somaBase : 0)));
}

export function calcularSemana(cad: Cadastro, sem: Semana): ResultadoSemana {
  const produtos = cad.produtos.map((p) => p.nome);
  const produtores = cad.produtores.map((p) => p.id);
  const mes = mesIndice(sem.referencia);
  const preco = Object.fromEntries(cad.produtos.map((p) => [p.nome, p.preco]));
  const doisDias = Object.fromEntries(cad.produtos.map((p) => [p.nome, p.doisDias]));
  const pedidoEscola = (codigo: string, produto: string) => n(sem.pedidoEscolas[codigo]?.[produto]);
  const escolasCodigos = cad.escolas.map((e) => e.codigo);

  // Dia de cada escola (_ENTREGA linhas 21+; fora do mapa = SEG).
  const diaEscola: Record<string, DiaRota> = {};
  const ordemMapa: { codigo: string; dia: DiaRota }[] = [];
  for (const rota of sem.rotas) {
    for (const p of rota.paradas) {
      if (!(p.codigo in diaEscola)) diaEscola[p.codigo] = rota.dia;
      ordemMapa.push({ codigo: p.codigo, dia: rota.dia });
    }
  }
  for (const c of escolasCodigos) diaEscola[c] ??= "SEG";

  // 1. Divisão (_AUX_DIVISAO) e pedido a cada produtor (Entrada 210–231).
  const divisaoCalculada: PorProdutorProduto = Object.fromEntries(produtores.map((p) => [p, {}]));
  const pedidoProdutor: PorProdutorProduto = Object.fromEntries(produtores.map((p) => [p, {}]));
  const faltaNaDivisao: Record<string, number> = {};
  const pedidoTotal: Record<string, number> = {};
  for (const produto of produtos) {
    pedidoTotal[produto] = soma(escolasCodigos.map((c) => pedidoEscola(c, produto)));
    const caps = produtores.map((p) => {
      const semana = sem.capacidadeSemana[produto]?.[p];
      if (typeof semana === "number") return semana;
      return mes === 0 ? 0 : n(cad.capacidade[produto]?.[p]?.[mes - 1]);
    });
    const q = dividirProduto(pedidoTotal[produto], caps);
    produtores.forEach((p, i) => {
      divisaoCalculada[p][produto] = q[i];
      const manual = digitado(sem.pedidoProdutorManual, p, produto);
      pedidoProdutor[p][produto] = manual !== undefined ? manual : q[i];
    });
    faltaNaDivisao[produto] = Math.max(pedidoTotal[produto] - soma(produtores.map((p) => pedidoProdutor[p][produto])), 0);
  }

  // 2. Planejado por dia (abas PROD, colunas T e U).
  const entregaProduto: Record<string, LinhaEntregaProduto> = {};
  const plan1: PorProdutorProduto = Object.fromEntries(produtores.map((p) => [p, {}]));
  const plan2: PorProdutorProduto = Object.fromEntries(produtores.map((p) => [p, {}]));
  for (const produto of produtos) {
    const pedidoSeg = soma(escolasCodigos.filter((c) => diaEscola[c] === "SEG").map((c) => pedidoEscola(c, produto)));
    const pedidoTer = pedidoTotal[produto] - pedidoSeg;
    const parteSeg = pedidoTotal[produto] <= 0 ? 0 : pedidoSeg / pedidoTotal[produto]; // _AUX_DIVISAO U
    for (const p of produtores) {
      const b = pedidoProdutor[p][produto];
      const t = b <= 0 ? 0 : doisDias[produto] ? arred(b * parteSeg) : b;
      plan1[p][produto] = t;
      plan2[p][produto] = b <= 0 ? 0 : b - t;
    }
    const entregue1 = soma(produtores.map((p) => digitado(sem.entrega1, p, produto) ?? plan1[p][produto]));
    const entregue2 = soma(produtores.map((p) => digitado(sem.entrega2, p, produto) ?? plan2[p][produto]));
    const planejado1 = soma(produtores.map((p) => n(plan1[p][produto])));
    const planejado2 = soma(produtores.map((p) => n(plan2[p][produto])));
    const precisa1 =
      planejado2 > 0.004 ? pedidoSeg : sem.regraPrimeiroDia === "corrigida" ? pedidoSeg + Math.max(0, pedidoTer - entregue2) : pedidoSeg + pedidoTer;
    const fator1 = precisa1 <= 0.0001 ? 1 : entregue1 >= precisa1 - 0.05 ? 1 : entregue1 / precisa1;
    const disponivel2 = entregue1 + entregue2 - pedidoSeg * fator1;
    const fator2 = pedidoTer <= 0.0001 ? 1 : disponivel2 >= pedidoTer - 0.05 ? 1 : Math.max(0, disponivel2) / pedidoTer;
    const naoLancado = soma(
      produtores.map(
        (p) =>
          (digitado(sem.entrega1, p, produto) === undefined ? plan1[p][produto] : 0) +
          (digitado(sem.entrega2, p, produto) === undefined ? plan2[p][produto] : 0),
      ),
    );
    entregaProduto[produto] = {
      pedidoSeg,
      pedidoTer,
      planejado1,
      planejado2,
      entregue1,
      entregue2,
      precisa1,
      fator1,
      disponivel2,
      fator2,
      faltaDividida: arred(pedidoSeg * (1 - fator1) + pedidoTer * (1 - fator2)),
      planejadoNaoLancado: naoLancado,
    };
  }

  // 3. Mapa de montagem (_MAPA): divide o que chegou entre as escolas, na
  // ordem das rotas de cada dia, sem passar do pedido.
  const enviado: Record<string, Record<string, number>> = {};
  const noMapa = new Set<string>();
  for (const produto of produtos) {
    const acumulado: Record<DiaRota, number> = { SEG: 0, TER: 0 };
    for (const { codigo, dia } of ordemMapa) {
      const pedido = pedidoEscola(codigo, produto);
      acumulado[dia] += pedido;
      const f = dia === "TER" ? entregaProduto[produto].fator2 : entregaProduto[produto].fator1;
      const aw = acumulado[dia];
      const valor =
        f >= 1 ? pedido : Math.max(0, Math.min(pedido, arred(arredBaixo(aw * f + 1e-9) - arredBaixo((aw - pedido) * f + 1e-9))));
      enviado[codigo] ??= {};
      if (!noMapa.has(`${codigo}|${produto}`)) {
        enviado[codigo][produto] = valor;
        noMapa.add(`${codigo}|${produto}`);
      }
    }
  }
  // Escola fora do mapa (ficha, coluna Z).
  for (const codigo of escolasCodigos) {
    enviado[codigo] ??= {};
    for (const produto of produtos) {
      if (noMapa.has(`${codigo}|${produto}`)) continue;
      const b = pedidoEscola(codigo, produto);
      const f = diaEscola[codigo] === "TER" ? entregaProduto[produto].fator2 : entregaProduto[produto].fator1;
      enviado[codigo][produto] = f >= 1 ? b : Math.min(b, arredBaixo(b * f));
    }
  }

  // 4. Entrega extra (_EXTRA): vai para as escolas que ficaram faltando, na
  // ordem da rota; o produtor recebe só pelo que foi usado (dividido igual).
  const extraEscola: Record<string, Record<string, number>> = {};
  const extraPago: PorProdutorProduto = Object.fromEntries(produtores.map((p) => [p, {}]));
  const escolasMapa = [...new Set(ordemMapa.map((o) => o.codigo))];
  for (const produto of produtos) {
    const trazido = produtores.map((p) => n(digitado(sem.extra, p, produto)));
    const totalExtra = soma(trazido);
    let faltaAntes = 0;
    let faltaTotal = 0;
    for (const codigo of escolasMapa) {
      const falta = Math.max(0, pedidoEscola(codigo, produto) - n(enviado[codigo]?.[produto]));
      const recebe = Math.min(falta, Math.max(0, totalExtra - faltaAntes));
      if (recebe > 0) (extraEscola[codigo] ??= {})[produto] = recebe;
      faltaAntes += falta;
      faltaTotal += falta;
    }
    const usado = Math.min(totalExtra, faltaTotal);
    const comExtra = trazido.filter((v) => v > 0).length;
    let nivel = comExtra === 0 ? 0 : usado / comExtra;
    for (let it = 0; it < 21; it++) {
      const acima = trazido.filter((v) => v > nivel).length;
      if (acima === 0) break;
      nivel = (usado - soma(trazido.filter((v) => v > 0 && v <= nivel))) / acima;
    }
    produtores.forEach((p, i) => {
      const t = trazido[i];
      extraPago[p][produto] = t <= 0 ? 0 : usado >= totalExtra - 0.0001 ? t : Math.min(t, nivel);
    });
  }

  // 5. Fichas das escolas: em branco = o que o mapa mandou.
  const fichas: Record<string, Record<string, FichaProduto>> = {};
  for (const codigo of escolasCodigos) {
    fichas[codigo] = {};
    for (const produto of produtos) {
      const b = pedidoEscola(codigo, produto);
      const r = sem.retornos[codigo]?.[produto] ?? {};
      const z = n(enviado[codigo]?.[produto]);
      const v = typeof r.recebido === "number" ? r.recebido : b > 0 ? z : null;
      const rejeitado = n(r.rejeitado);
      const aceito = v === null ? 0 : Math.max(v - rejeitado, 0);
      const k = n(extraEscola[codigo]?.[produto]);
      const segundaViagem = k > 0.004 ? k : 0;
      const totalAceito = aceito + segundaViagem;
      fichas[codigo][produto] = {
        pedido: b,
        enviado: z,
        bruto: v,
        rejeitado,
        aceito,
        segundaViagem,
        totalAceito,
        cobrado: Math.min(totalAceito, b),
        falta: v === null ? 0 : Math.max(b - totalAceito, 0),
        excedente: v === null ? 0 : Math.max(totalAceito - b, 0),
        faltouNoGalpao: typeof r.recebido !== "number" && b > 0 && z < b - 0.0001,
        motivo: r.motivo,
        situacao: r.situacao,
      };
    }
  }

  // 6. Produtores (abas PROD): paga o aceito, até o pedido, mais o extra usado.
  const resultadoProdutores: Record<string, Record<string, ProdutorProduto>> = {};
  const pagarProdutor: Record<string, number> = {};
  for (const p of produtores) {
    resultadoProdutores[p] = {};
    let total = 0;
    for (const produto of produtos) {
      const b = pedidoProdutor[p][produto];
      const d1 = digitado(sem.entrega1, p, produto);
      const d2 = digitado(sem.entrega2, p, produto);
      const extra = n(digitado(sem.extra, p, produto));
      const entregue = n(d1) + n(d2) + extra;
      const pagoKg = Math.min(entregue - extra, b) + extraPago[p][produto];
      const precoLiquido = preco[produto] - cad.taxaLogistica;
      const valor = arred(pagoKg * precoLiquido);
      total += valor;
      resultadoProdutores[p][produto] = {
        pedido: b,
        planejado1: plan1[p][produto],
        planejado2: plan2[p][produto],
        entregue,
        extra,
        extraPago: extraPago[p][produto],
        pagoKg,
        precoLiquido,
        valor,
        diferencaPedido:
          d1 === undefined && d2 === undefined ? 0 : Math.max(b - ((d1 ?? plan1[p][produto]) + (d2 ?? plan2[p][produto])), 0),
      };
    }
    pagarProdutor[p] = total;
  }

  // 7. RESUMO e BALANÇO.
  const produtosResumo: ResumoProduto[] = produtos.map((produto) => {
    const pedido = pedidoTotal[produto];
    const somaCobrado = soma(escolasCodigos.map((c) => fichas[c][produto].cobrado));
    const conferido = typeof sem.conferidoPrefeitura[produto] === "number" ? sem.conferidoPrefeitura[produto] : null;
    const cobradoKg = conferido !== null ? Math.min(pedido, conferido) : Math.min(pedido, somaCobrado);
    const entregueGalpao = soma(produtores.map((p) => resultadoProdutores[p][produto].entregue));
    const pagoKg = soma(produtores.map((p) => resultadoProdutores[p][produto].pagoKg));
    return {
      produto,
      pedido,
      cobradoKg,
      naoCobradoKg: 0,
      valorCobrado: arred(cobradoKg * preco[produto]),
      naoCobradoValor: 0,
      conferido,
      rejeitadoEscola: soma(escolasCodigos.map((c) => fichas[c][produto].rejeitado)),
      entregueGalpao,
      pagoKg,
      sobraGalpao: entregueGalpao - pagoKg,
      valorPago: soma(produtores.map((p) => resultadoProdutores[p][produto].valor)),
      aceitoGalpao: entregueGalpao,
    };
  });
  const entregasLancadasKg = soma(produtosResumo.map((r) => r.entregueGalpao));
  for (const r of produtosResumo) {
    r.naoCobradoKg = entregasLancadasKg === 0 ? 0 : r.pedido - r.cobradoKg;
    r.naoCobradoValor = entregasLancadasKg === 0 ? 0 : arred(r.pedido * preco[r.produto]) - r.valorCobrado;
  }
  const cobrar = soma(produtosResumo.map((r) => r.valorCobrado));
  const pagar = soma(produtosResumo.map((r) => r.valorPago));
  const perdasDepoisGalpao = sem.romaneiosConferidos
    ? soma(produtosResumo.map((r) => arred((r.aceitoGalpao - r.cobradoKg) * preco[r.produto])))
    : null;
  const perdas =
    perdasDepoisGalpao === null ? null : soma(produtosResumo.map((r) => arred((r.aceitoGalpao - r.pagoKg) * preco[r.produto]))) - perdasDepoisGalpao;
  const c = sem.custos;
  const custos = c.transporte + c.montagem + c.administrativo + c.embalagens + c.escritorio + c.impostos + c.contabilidade + c.conselho;

  return {
    mesIndice: mes,
    divisaoCalculada,
    faltaNaDivisao,
    pedidoProdutor,
    diaEscola,
    entregaProduto,
    enviado,
    extraEscola,
    fichas,
    produtores: resultadoProdutores,
    pagarProdutor,
    resumo: {
      cobrar,
      pagar,
      margem: cobrar - pagar,
      taxaLogistica: arred(cad.taxaLogistica * soma(produtosResumo.map((r) => r.pagoKg))),
      perdas,
      perdasDepoisGalpao,
      entregasLancadasKg,
      pedidoTotal: soma(Object.values(pedidoTotal)),
      extrasPagos: soma(
        produtores.map((p) => arred(soma(produtos.map((pr) => resultadoProdutores[p][pr].extraPago * resultadoProdutores[p][pr].precoLiquido)))),
      ),
      produtos: produtosResumo,
      totais: {
        pedido: soma(produtosResumo.map((r) => r.pedido)),
        cobradoKg: soma(produtosResumo.map((r) => r.cobradoKg)),
        valorCobrado: cobrar,
        entregueGalpao: entregasLancadasKg,
        pagoKg: soma(produtosResumo.map((r) => r.pagoKg)),
        valorPago: pagar,
      },
    },
    balanco: { cobrado: cobrar, pago: pagar, perdas, margem: cobrar - pagar, custos, saldo: cobrar - pagar - custos },
  };
}
