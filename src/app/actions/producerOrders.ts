"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable, getCurrentPrice } from "@/lib/week";
import { qtySchema } from "@/lib/validation";
import type { SaveResult } from "./schoolOrders";

// CA-PED-PROD-01..05, regra absoluta #1: pedido ao produtor e
// COMPLETAMENTE independente da entrega — tabela propria, nunca
// escreve em ProducerDelivery.
export async function saveProducerOrder(
  weekId: string,
  producerId: string,
  productId: string,
  orderedQtyRaw: number | string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const orderedQty = qtySchema.parse(orderedQtyRaw);

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);
    const price = await getCurrentPrice(productId, week.referenceDate);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.producerOrder.findUnique({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
      });
      const saved = await tx.producerOrder.upsert({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
        update: { orderedQty, priceId: price.id },
        create: { weekId, producerId, productId, orderedQty, priceId: price.id },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "PRODUCER_ORDER_UPDATE" : "PRODUCER_ORDER_CREATE",
          entityType: "ProducerOrder",
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
