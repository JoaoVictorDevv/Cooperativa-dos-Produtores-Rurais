"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable } from "@/lib/week";
import { qtySchema } from "@/lib/validation";
import type { SaveResult } from "./schoolOrders";

// CA-DEV-*: devolucao do produtor (mercadoria rejeitada no galpao).
// Regra operacional para CA-DEV-08: bloqueia devolucao maior que a
// entrega correspondente.
export async function saveProducerReturn(
  weekId: string,
  producerId: string,
  productId: string,
  returnedQtyRaw: number | string,
  returnReasonId: string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const returnedQty = qtySchema.parse(returnedQtyRaw);
    if (!returnReasonId) {
      return { ok: false, error: "Selecione o motivo da devolucao." };
    }

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    const delivery = await prisma.producerDelivery.findUnique({
      where: { weekId_producerId_productId: { weekId, producerId, productId } },
    });
    const deliveredQty = delivery ? Number(delivery.deliveredQty) : 0;
    if (returnedQty > deliveredQty) {
      return {
        ok: false,
        error: `Devolucao (${returnedQty}) nao pode ser maior que a entrega (${deliveredQty}).`,
      };
    }

    const existing = await prisma.producerReturn.findFirst({ where: { weekId, producerId, productId } });
    const saved = existing
      ? await prisma.producerReturn.update({
          where: { id: existing.id },
          data: { returnedQty, returnReasonId },
        })
      : await prisma.producerReturn.create({
          data: { weekId, producerId, productId, returnedQty, returnReasonId },
        });

    await writeAudit({
      userId: user.id,
      action: existing ? "PRODUCER_RETURN_UPDATE" : "PRODUCER_RETURN_CREATE",
      entityType: "ProducerReturn",
      entityId: saved.id,
      before: existing,
      after: saved,
    });
    revalidatePath("/produtores");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
