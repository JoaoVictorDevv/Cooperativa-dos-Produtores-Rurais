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

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    const existing = await prisma.schoolDelivery.findUnique({ where: { weekId_schoolId: { weekId, schoolId } } });
    const saved = await prisma.schoolDelivery.upsert({
      where: { weekId_schoolId: { weekId, schoolId } },
      update: { weekday, deliveredAt: new Date(deliveredAtRaw) },
      create: { weekId, schoolId, weekday, deliveredAt: new Date(deliveredAtRaw) },
    });
    await writeAudit({
      userId: user.id,
      action: existing ? "SCHOOL_DELIVERY_UPDATE" : "SCHOOL_DELIVERY_CREATE",
      entityType: "SchoolDelivery",
      entityId: saved.id,
      before: existing,
      after: saved,
    });
    revalidatePath("/escolas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
