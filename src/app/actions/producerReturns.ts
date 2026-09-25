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

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    // Corrigir pra zero remove o lancamento (ver mesma regra em
    // schoolReturns.ts) em vez de gravar devolucao zero com motivo.
    if (returnedQty === 0) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.producerReturn.findUnique({
          where: { weekId_producerId_productId: { weekId, producerId, productId } },
        });
        if (!existing) return { ok: true };
        await tx.producerReturn.delete({ where: { id: existing.id } });
        await writeAudit(
          {
            userId: user.id,
            action: "PRODUCER_RETURN_DELETE",
            entityType: "ProducerReturn",
            entityId: existing.id,
            before: existing,
            after: undefined,
          },
          tx,
        );
        revalidatePath("/produtores");
        return { ok: true };
      });
    }

    if (!returnReasonId) {
      return { ok: false, error: "Selecione o motivo da devolucao." };
    }

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

    const reason = await prisma.returnReason.findFirst({ where: { id: returnReasonId, active: true } });
    if (!reason) return { ok: false, error: "Selecione um motivo de devolucao ativo." };

    await prisma.$transaction(async (tx) => {
      const existing = await tx.producerReturn.findUnique({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
      });
      const saved = await tx.producerReturn.upsert({
        where: { weekId_producerId_productId: { weekId, producerId, productId } },
        update: { returnedQty, returnReasonId },
        create: { weekId, producerId, productId, returnedQty, returnReasonId },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "PRODUCER_RETURN_UPDATE" : "PRODUCER_RETURN_CREATE",
          entityType: "ProducerReturn",
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
