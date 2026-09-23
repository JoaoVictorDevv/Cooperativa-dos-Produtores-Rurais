"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable } from "@/lib/week";
import { qtySchema } from "@/lib/validation";
import type { SaveResult } from "./schoolOrders";

// CA-DEV-01/03/04/05/06/07/08: devolucao da escola, vinculada a
// semana+produto, com motivo obrigatorio. Regra operacional definida
// para CA-DEV-08: devolucao maior que o pedido correspondente e
// BLOQUEADA (nao ha como devolver mais do que foi pedido).
export async function saveSchoolReturn(
  weekId: string,
  schoolId: string,
  productId: string,
  returnedQtyRaw: number | string,
  returnReasonId: string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const returnedQty = qtySchema.parse(returnedQtyRaw);

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    // Corrigir uma devolucao pra zero significa "essa devolucao nao devia
    // ter sido lancada" — o modelo nao tem um conceito de "devolucao zero
    // com motivo", entao a correcao remove o lancamento em vez de gravar
    // uma linha com quantidade zero. Sem devolucao existente, e um no-op
    // (nada foi digitado, nao ha nada pra corrigir) e nao exige motivo.
    if (returnedQty === 0) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.schoolReturn.findUnique({
          where: { weekId_schoolId_productId: { weekId, schoolId, productId } },
        });
        if (!existing) return { ok: true };
        await tx.schoolReturn.delete({ where: { id: existing.id } });
        await writeAudit(
          {
            userId: user.id,
            action: "SCHOOL_RETURN_DELETE",
            entityType: "SchoolReturn",
            entityId: existing.id,
            before: existing,
            after: undefined,
          },
          tx,
        );
        revalidatePath("/escolas");
        return { ok: true };
      });
    }

    if (!returnReasonId) {
      return { ok: false, error: "Selecione o motivo da devolucao." };
    }

    const order = await prisma.schoolOrder.findUnique({
      where: { weekId_schoolId_productId: { weekId, schoolId, productId } },
    });
    const orderedQty = order ? Number(order.orderedQty) : 0;
    if (returnedQty > orderedQty) {
      return {
        ok: false,
        error: `Devolucao (${returnedQty}) nao pode ser maior que o pedido (${orderedQty}).`,
      };
    }

    const reason = await prisma.returnReason.findFirst({ where: { id: returnReasonId, active: true } });
    if (!reason) return { ok: false, error: "Selecione um motivo de devolucao ativo." };

    await prisma.$transaction(async (tx) => {
      const existing = await tx.schoolReturn.findUnique({
        where: { weekId_schoolId_productId: { weekId, schoolId, productId } },
      });
      const saved = await tx.schoolReturn.upsert({
        where: { weekId_schoolId_productId: { weekId, schoolId, productId } },
        update: { returnedQty, returnReasonId },
        create: { weekId, schoolId, productId, returnedQty, returnReasonId },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "SCHOOL_RETURN_UPDATE" : "SCHOOL_RETURN_CREATE",
          entityType: "SchoolReturn",
          entityId: saved.id,
          before: existing,
          after: saved,
        },
        tx,
      );
    });
    revalidatePath("/escolas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
