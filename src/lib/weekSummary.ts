import { prisma } from "./prisma";
import {
  balanceStatus,
  grossMargin,
  producerPayment,
  reconcile,
  schoolNetQty,
  schoolValue,
  treasuryTotal,
  weekBalance,
  type BalanceStatus,
  type ReconciliationResult,
} from "./calc";
import type { CostCategory } from "@prisma/client";

export interface TreasuryLine {
  schoolId: string;
  schoolName: string;
  productId: string;
  productName: string;
  productSlug: string;
  orderedQty: number;
  returnedQty: number;
  netQty: number;
  price: number;
  value: number;
}

// CA-RES-01, secao 25: valor a cobrar da prefeitura, escola por escola,
// produto por produto — sempre Σ (pedido - devolucao) * preco.
export async function getTreasuryLines(weekId: string): Promise<TreasuryLine[]> {
  const orders = await prisma.schoolOrder.findMany({
    where: { weekId },
    include: { school: true, product: true, price: true },
  });
  const returns = await prisma.schoolReturn.findMany({ where: { weekId } });
  const returnedByKey = new Map<string, number>();
  for (const r of returns) {
    const key = `${r.schoolId}:${r.productId}`;
    returnedByKey.set(key, (returnedByKey.get(key) ?? 0) + Number(r.returnedQty));
  }

  return orders.map((o) => {
    const returnedQty = returnedByKey.get(`${o.schoolId}:${o.productId}`) ?? 0;
    const orderedQty = Number(o.orderedQty);
    const price = Number(o.price.price);
    return {
      schoolId: o.schoolId,
      schoolName: o.school.name,
      productId: o.productId,
      productName: o.product.name,
      productSlug: o.product.slug,
      orderedQty,
      returnedQty,
      netQty: schoolNetQty(orderedQty, returnedQty),
      price,
      value: schoolValue(orderedQty, returnedQty, price),
    };
  });
}

export interface ProducerPaymentLine {
  producerId: string;
  producerName: string;
  productId: string;
  productName: string;
  productSlug: string;
  deliveredQty: number;
  returnedQty: number;
  netQty: number;
  price: number;
  logisticsDeductionPerKg: number;
  payment: number;
}

// CA-PAG-*, secao 27: pagamento SEMPRE sobre a entrega real, nunca o pedido.
export async function getProducerPaymentLines(weekId: string): Promise<ProducerPaymentLine[]> {
  const deliveries = await prisma.producerDelivery.findMany({
    where: { weekId },
    include: { producer: true, product: true, price: true },
  });
  const returns = await prisma.producerReturn.findMany({ where: { weekId } });
  const returnedByKey = new Map<string, number>();
  for (const r of returns) {
    const key = `${r.producerId}:${r.productId}`;
    returnedByKey.set(key, (returnedByKey.get(key) ?? 0) + Number(r.returnedQty));
  }

  return deliveries.map((d) => {
    const returnedQty = returnedByKey.get(`${d.producerId}:${d.productId}`) ?? 0;
    const deliveredQty = Number(d.deliveredQty);
    const price = Number(d.price.price);
    const logisticsDeductionPerKg = Number(d.logisticsDeductionSnapshot);
    return {
      producerId: d.producerId,
      producerName: d.producer.name,
      productId: d.productId,
      productName: d.product.name,
      productSlug: d.product.slug,
      deliveredQty,
      returnedQty,
      netQty: deliveredQty - returnedQty,
      price,
      logisticsDeductionPerKg,
      payment: producerPayment(deliveredQty, returnedQty, price, logisticsDeductionPerKg),
    };
  });
}

export interface WeekFinancialSummary {
  treasuryLines: TreasuryLine[];
  treasuryTotal: number;
  producerLines: ProducerPaymentLine[];
  producersTotal: number;
  grossMargin: number;
  costs: { category: CostCategory; amount: number }[];
  totalCosts: number;
  balance: number;
  balanceStatus: BalanceStatus;
  reconciliation: ReconciliationResult;
}

export async function getWeekFinancialSummary(weekId: string): Promise<WeekFinancialSummary> {
  const [treasuryLines, producerLines, costs] = await Promise.all([
    getTreasuryLines(weekId),
    getProducerPaymentLines(weekId),
    prisma.weeklyCost.findMany({ where: { weekId } }),
  ]);

  const treasuryTotalValue = treasuryTotal(
    treasuryLines.map((l) => ({ orderedQty: l.orderedQty, returnedQty: l.returnedQty, price: l.price })),
  );
  const producersTotalValue = producerLines.reduce((sum, l) => sum + l.payment, 0);
  const margin = grossMargin(treasuryTotalValue, producersTotalValue);
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);
  const balance = weekBalance(margin, totalCosts);

  // CA-CONF-*: soma dos pagamentos individuais por produtor vs total geral
  const paymentByProducer = new Map<string, number>();
  for (const line of producerLines) {
    paymentByProducer.set(line.producerId, (paymentByProducer.get(line.producerId) ?? 0) + line.payment);
  }

  return {
    treasuryLines,
    treasuryTotal: treasuryTotalValue,
    producerLines,
    producersTotal: Math.round(producersTotalValue * 100) / 100,
    grossMargin: margin,
    costs: costs.map((c) => ({ category: c.category, amount: Number(c.amount) })),
    totalCosts: Math.round(totalCosts * 100) / 100,
    balance,
    balanceStatus: balanceStatus(balance),
    reconciliation: reconcile([...paymentByProducer.values()], producersTotalValue),
  };
}

export interface PendingProducer {
  producerId: string;
  producerName: string;
  pendingProducts: { productId: string; productName: string; productSlug: string; orderedQty: number }[];
}

// Usado no dashboard e na tela de produtores: pedido feito, entrega
// ainda nao registrada.
export async function getPendingProducerDeliveries(weekId: string): Promise<PendingProducer[]> {
  const orders = await prisma.producerOrder.findMany({
    where: { weekId, orderedQty: { gt: 0 } },
    include: { producer: true, product: true },
  });
  const deliveries = await prisma.producerDelivery.findMany({ where: { weekId } });
  const deliveredKeys = new Set(deliveries.map((d) => `${d.producerId}:${d.productId}`));

  const byProducer = new Map<string, PendingProducer>();
  for (const order of orders) {
    const key = `${order.producerId}:${order.productId}`;
    if (deliveredKeys.has(key)) continue;
    const entry = byProducer.get(order.producerId) ?? {
      producerId: order.producerId,
      producerName: order.producer.name,
      pendingProducts: [],
    };
    entry.pendingProducts.push({
      productId: order.productId,
      productName: order.product.name,
      productSlug: order.product.slug,
      orderedQty: Number(order.orderedQty),
    });
    byProducer.set(order.producerId, entry);
  }
  return [...byProducer.values()];
}
