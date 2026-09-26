// Regras de calculo absolutas (secao 55 da especificacao). Funcoes puras,
// sem acesso a banco — cada tela/action resolve preco/deducao vigentes e
// passa numeros ja prontos para aqui.

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Regra #5: liquido da escola = pedido - devolucao
export function schoolNetQty(orderedQty: number, returnedQty: number): number {
  return round2(orderedQty - returnedQty);
}

export function schoolValue(orderedQty: number, returnedQty: number, price: number): number {
  return round2(schoolNetQty(orderedQty, returnedQty) * price);
}

// Regra #9: total prefeitura = soma de (pedido - devolucao) * preco
export function treasuryTotal(
  lines: { orderedQty: number; returnedQty: number; price: number }[],
): number {
  return round2(
    lines.reduce((sum, l) => sum + schoolNetQty(l.orderedQty, l.returnedQty) * l.price, 0),
  );
}

// Regra decidida em 26/09/2026 (ciclos novos): cada linha e arredondada a
// centavos e o total e a soma das linhas arredondadas — igual a planilha.
// A funcao acima (arredonda so no fim) continua valendo para ciclos antigos.
export function treasuryTotalPerLine(
  lines: { orderedQty: number; returnedQty: number; price: number }[],
): number {
  return round2(lines.reduce((sum, l) => sum + schoolValue(l.orderedQty, l.returnedQty, l.price), 0));
}

// Regra #6: liquido do produtor = entrega - devolucao
export function producerNetQty(deliveredQty: number, returnedQty: number): number {
  return round2(deliveredQty - returnedQty);
}

// Regra #7: preco liquido = preco - deducao (normalmente R$ 3,67)
export function netPrice(price: number, logisticsDeductionPerKg: number): number {
  return round2(price - logisticsDeductionPerKg);
}

// Regra #4 e #8: pagamento = (entrega - devolucao) * (preco - deducao).
// Usa SEMPRE a entrega real, nunca o pedido.
export function producerPayment(
  deliveredQty: number,
  returnedQty: number,
  price: number,
  logisticsDeductionPerKg: number,
): number {
  return round2(
    producerNetQty(deliveredQty, returnedQty) * netPrice(price, logisticsDeductionPerKg),
  );
}

export function producersTotal(
  lines: { deliveredQty: number; returnedQty: number; price: number; logisticsDeductionPerKg: number }[],
): number {
  return round2(
    lines.reduce(
      (sum, l) => sum + producerPayment(l.deliveredQty, l.returnedQty, l.price, l.logisticsDeductionPerKg),
      0,
    ),
  );
}

// Regra #10: margem = valor prefeitura - valor produtores
export function grossMargin(treasuryValue: number, producersValue: number): number {
  return round2(treasuryValue - producersValue);
}

// Regra #11: saldo = margem - custos
export function weekBalance(margin: number, totalCosts: number): number {
  return round2(margin - totalCosts);
}

export type BalanceStatus = "POSITIVO" | "ZERO" | "NEGATIVO";

export function balanceStatus(balance: number): BalanceStatus {
  if (balance > 0) return "POSITIVO";
  if (balance < 0) return "NEGATIVO";
  return "ZERO";
}

// Painel Diferenca do galpao (plano docs/plano-de-implementacao.md §7):
// compara, por produto, o pedido das escolas com o que efetivamente saiu
// do galpao pros produtores (entrega bruta - devolucao). Isso NAO e o
// mesmo que estoque atual do galpao nem atendimento individual de escola
// — e uma comparacao agregada por produto, sempre na mesma unidade dele.
export function netProducerDelivered(deliveredQty: number, returnedQty: number): number {
  return round2(deliveredQty - returnedQty);
}

export function warehouseDifference(orderedQty: number, netDeliveredQty: number): number {
  return round2(netDeliveredQty - orderedQty);
}

export type DifferenceStatus = "FALTA" | "SOBRA" | "OK";

export function differenceStatus(difference: number): DifferenceStatus {
  if (difference < 0) return "FALTA";
  if (difference > 0) return "SOBRA";
  return "OK";
}

// Conferencia financeira (secao 33-34)
export interface ReconciliationResult {
  sumIndividual: number;
  total: number;
  difference: number;
  status: "OK" | "DIVERGENCIA";
}

export function reconcile(individualPayments: number[], total: number): ReconciliationResult {
  const sumIndividual = round2(individualPayments.reduce((a, b) => a + b, 0));
  const difference = round2(sumIndividual - total);
  return {
    sumIndividual,
    total: round2(total),
    difference,
    status: difference === 0 ? "OK" : "DIVERGENCIA",
  };
}

// Limite anual PNAE (secao 39-40)
export const PNAE_ANNUAL_LIMIT = 40000;

export type PnaeAlertLevel = "OK" | "ATENCAO" | "ESTOURADO";

export interface PnaeUsage {
  accumulated: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  alertLevel: PnaeAlertLevel;
}

export function pnaeUsage(accumulated: number, limit: number = PNAE_ANNUAL_LIMIT): PnaeUsage {
  const remaining = round2(Math.max(limit - accumulated, 0));
  const percentUsed = round2((accumulated / limit) * 100);
  let alertLevel: PnaeAlertLevel = "OK";
  if (accumulated >= limit) alertLevel = "ESTOURADO";
  else if (percentUsed >= 80) alertLevel = "ATENCAO";
  return { accumulated: round2(accumulated), limit, remaining, percentUsed, alertLevel };
}

// Ciclo PNAE: outubro a setembro. Dado uma data, devolve o intervalo
// [inicio, fim) do ciclo anual ao qual ela pertence.
export function pnaeCycleRange(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0 = jan ... 9 = out
  const cycleStartYear = month >= 9 ? year : year - 1;
  const start = new Date(Date.UTC(cycleStartYear, 9, 1));
  const end = new Date(Date.UTC(cycleStartYear + 1, 9, 1));
  return { start, end };
}
