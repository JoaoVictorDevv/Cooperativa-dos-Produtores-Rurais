"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable } from "@/lib/week";
import type { SaveResult } from "./schoolOrders";

const WeekdaySchema = z.enum(["SEGUNDA", "TERCA", "EXCEPCIONAL"]);

// CA-ENT-ESC-01..06: confirmacao operacional de quando a escola foi
// atendida (nao entra na formula financeira — essa usa pedido-devolucao).
export async function saveSchoolDelivery(
  weekId: string,
  schoolId: string,
  weekdayRaw: string,
  deliveredAtRaw: string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const weekday = WeekdaySchema.parse(weekdayRaw);
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

    await prisma.$transaction(async (tx) => {
      const existing = await tx.schoolDelivery.findUnique({ where: { weekId_schoolId: { weekId, schoolId } } });
      const saved = await tx.schoolDelivery.upsert({
        where: { weekId_schoolId: { weekId, schoolId } },
        update: { weekday, deliveredAt },
        create: { weekId, schoolId, weekday, deliveredAt },
      });
      await writeAudit(
        {
          userId: user.id,
          action: existing ? "SCHOOL_DELIVERY_UPDATE" : "SCHOOL_DELIVERY_CREATE",
          entityType: "SchoolDelivery",
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
