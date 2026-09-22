import type { PrismaClient } from "@prisma/client";
import { pnaeCycleRange, pnaeUsage, producerPayment, type PnaeUsage } from "./calc";

// Soma os pagamentos reais (entrega - devolucao) * (preco - deducao) de um
// produtor dentro do ciclo PNAE (out-set) que contem `referenceDate`.
// Nao depende de nenhum campo "acumulado" gravado a parte — e sempre
// recalculado a partir do historico de ProducerDelivery/ProducerReturn
// (CA-PNAE-01, CA-PNAE-02: criar semana nao exige lancamento manual).
export async function getProducerAnnualTotal(
  prisma: PrismaClient,
  producerId: string,
  referenceDate: Date = new Date(),
): Promise<number> {
  const { start, end } = pnaeCycleRange(referenceDate);

  const deliveries = await prisma.producerDelivery.findMany({
    where: { producerId, deliveredAt: { gte: start, lt: end } },
    include: { price: true },
  });
  if (deliveries.length === 0) return 0;

  const deliveryWeekIds = [...new Set(deliveries.map((delivery) => delivery.weekId))];
  const returnsByKey = new Map<string, number>();
  const returns = await prisma.producerReturn.findMany({
    where: {
      producerId,
      // SPEC-001 CA-05.2: a devolucao pertence ao periodo operacional da
      // entrega, mesmo quando foi digitada posteriormente.
      weekId: { in: deliveryWeekIds },
    },
  });
  for (const r of returns) {
    const key = `${r.weekId}:${r.productId}`;
    returnsByKey.set(key, (returnsByKey.get(key) ?? 0) + Number(r.returnedQty));
  }

  let total = 0;
  for (const d of deliveries) {
    const key = `${d.weekId}:${d.productId}`;
    const returnedQty = returnsByKey.get(key) ?? 0;
    total += producerPayment(
      Number(d.deliveredQty),
      returnedQty,
      Number(d.price.price),
      Number(d.logisticsDeductionSnapshot),
    );
  }
  return Math.round(total * 100) / 100;
}

export async function getProducerPnaeUsage(
  prisma: PrismaClient,
  producerId: string,
  referenceDate: Date = new Date(),
): Promise<PnaeUsage> {
  const accumulated = await getProducerAnnualTotal(prisma, producerId, referenceDate);
  return pnaeUsage(accumulated);
}
