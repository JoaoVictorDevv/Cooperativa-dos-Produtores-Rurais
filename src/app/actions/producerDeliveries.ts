"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable, getCurrentPrice, getSettings } from "@/lib/week";
import { qtySchema } from "@/lib/validation";
import type { SaveResult } from "./schoolOrders";

// CA-ENT-PROD-01..07, regra absoluta #2 e #4: entrega real (normalmente
// domingo) — e esta tabela, nunca o pedido, que alimenta o pagamento.
// Aceita entrega menor, igual ou maior que o pedido sem nenhuma
// restricao (CA-ENT-PROD-03/04/05).
export async function saveProducerDelivery(
  weekId: string,
  producerId: string,
  productId: string,
  deliveredQtyRaw: number | string,
  deliveredAtRaw: string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const deliveredQty = qtySchema.parse(deliveredQtyRaw);
    if (!deliveredAtRaw) {
      return { ok: false, error: "Informe a data da entrega." };
    }
    const deliveredAt = new Date(deliveredAtRaw);
    if (Number.isNaN(deliveredAt.getTime())) {
      return { ok: false, error: "Informe uma data de entrega valida." };
    }

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);
    if (deliveredAt < week.startDate || deliveredAt > week.endDate) {
      return { ok: false, error: "A entrega precisa estar dentro do periodo da semana." };
    }

    const [price, settings] = await Promise.all([
      getCurrentPrice(productId, week.referenceDate),
      getSettings(),
    ]);

    await prisma.$transaction(async (tx) => {
      // Checagem contra devolucao dentro da MESMA transacao que a
      // gravacao, pra reduzir a janela de corrida entre ler e escrever
      // (duas edicoes simultaneas ainda podem colidir sob READ COMMITTED —
      // uma protecao a prova de concorrencia de verdade precisaria de uma
      // constraint no banco, documentado como pendencia pro olucasgon).
      const existingReturn = await tx.producerReturn.findUnique({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
      });
      const existingReturnedQty = existingReturn ? Number(existingReturn.returnedQty) : 0;
      if (deliveredQty < existingReturnedQty) {
        throw new Error(
          `Nao e possivel reduzir a entrega para ${deliveredQty} kg: ja ha ${existingReturnedQty} kg de ` +
            `devolucao registrada para este produto nesta semana. Corrija a devolucao primeiro.`,
        );
      }

      const existing = await tx.producerDelivery.findUnique({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
      });
      // Regra #55/secao 5: preco e deducao sao congelados no primeiro
      // lancamento (snapshot). Uma correcao de quantidade/data NAO deve
      // trocar silenciosamente esses valores pela configuracao atual —
      // por isso o update preserva o que ja estava gravado.
      const saved = await tx.producerDelivery.upsert({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
        update: {
          deliveredQty,
          deliveredAt,
        },
        create: {
          weekId,
          producerId,
          productId,
          deliveredQty,
          deliveredAt,
          priceId: price.id,
          logisticsDeductionSnapshot: settings.logisticsDeductionPerKg,
        },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "PRODUCER_DELIVERY_UPDATE" : "PRODUCER_DELIVERY_CREATE",
          entityType: "ProducerDelivery",
          entityId: saved.id,
          before: existing,
          after: saved,
        },
        tx,
      );
    });
    revalidatePath("/produtores");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
