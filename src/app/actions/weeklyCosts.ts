"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { assertWeekEditable } from "@/lib/week";
import { moneySchema } from "@/lib/validation";
import type { CostCategory } from "@prisma/client";
import type { SaveResult } from "./schoolOrders";

// CA-BAL-01/02/06: cada uma das 8 categorias e vinculada a semana; o
// total e o saldo (secao 30-32) sao sempre recalculados por query.
export async function saveWeeklyCost(
  weekId: string,
  category: CostCategory,
  amountRaw: number | string,
): Promise<SaveResult> {
  try {
    const user = await requireOperator();
    const amount = moneySchema.parse(amountRaw);

    const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
    assertWeekEditable(week);

    const existing = await prisma.weeklyCost.findUnique({ where: { weekId_category: { weekId, category } } });
    const saved = await prisma.weeklyCost.upsert({
      where: { weekId_category: { weekId, category } },
      update: { amount },
      create: { weekId, category, amount },
    });
    await writeAudit({
      userId: user.id,
      action: existing ? "WEEKLY_COST_UPDATE" : "WEEKLY_COST_CREATE",
      entityType: "WeeklyCost",
      entityId: saved.id,
      before: existing,
      after: saved,
    });
    revalidatePath("/balanco");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
