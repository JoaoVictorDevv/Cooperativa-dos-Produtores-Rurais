"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable } from "@/lib/week";
import { qtySchema } from "@/lib/validation";
import type { SaveResult } from "./schoolOrders";

// CA-DIV-01..06: divisao/planejamento — como a demanda foi repartida
// entre produtores. E uma tabela propria: alterar isto nunca toca no
// pedido real (ProducerOrder) nem na entrega (ProducerDelivery).
export async function saveProducerAllocation(
  weekId: string,
  productId: string,
  producerId: string,
  allocatedQtyRaw: number | string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const allocatedQty = qtySchema.parse(allocatedQtyRaw);

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.producerAllocation.findUnique({
        where: { weekId_productId_producerId: { weekId, productId, producerId } },
      });
      const saved = await tx.producerAllocation.upsert({
        where: { weekId_productId_producerId: { weekId, productId, producerId } },
        update: { allocatedQty },
        create: { weekId, productId, producerId, allocatedQty },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "PRODUCER_ALLOCATION_UPDATE" : "PRODUCER_ALLOCATION_CREATE",
          entityType: "ProducerAllocation",
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
