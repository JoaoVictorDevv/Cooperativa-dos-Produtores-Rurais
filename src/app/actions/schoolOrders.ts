"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable, getCurrentPrice } from "@/lib/week";
import { qtySchema } from "@/lib/validation";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

// CA-PED-ESC-01/02/03/04/07: lanca pedido por escola+produto, aceita
// zero, rejeita negativo, vincula a semana correta, e o total (CA-05/06)
// e sempre derivado por query — nunca fica desatualizado.
export async function saveSchoolOrder(
  weekId: string,
  schoolId: string,
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
      const existing = await tx.schoolOrder.findUnique({
        where: { weekId_schoolId_productId: { weekId, schoolId, productId } },
      });
      const saved = await tx.schoolOrder.upsert({
        where: { weekId_schoolId_productId: { weekId, schoolId, productId } },
        update: { orderedQty, priceId: price.id },
        create: { weekId, schoolId, productId, orderedQty, priceId: price.id },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "SCHOOL_ORDER_UPDATE" : "SCHOOL_ORDER_CREATE",
          entityType: "SchoolOrder",
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
