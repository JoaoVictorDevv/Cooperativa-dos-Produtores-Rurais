"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOperator, requireRole } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { getOpenWeek } from "@/lib/week";
import { getWeekClosingBlockers, validateOperationalWeekDates } from "@/lib/weekPolicy";

const CreateWeekSchema = z.object({
  referenceDate: z.string().min(1, "Informe a data de referencia"),
  startDate: z.string().min(1, "Informe a data inicial"),
  endDate: z.string().min(1, "Informe a data final"),
  notes: z.string().optional(),
});

export interface WeekFormState {
  error?: string;
}

// CA-SEM-01/02: so pode existir uma semana ABERTA por vez, e ela nunca
// copia lancamentos da semana anterior — nasce vazia.
export async function createWeek(_prev: WeekFormState, formData: FormData): Promise<WeekFormState> {
  const user = await requireOperator();

  const existing = await getOpenWeek();
  if (existing) {
    return { error: `Ja existe a Semana ${existing.number} aberta. Feche-a antes de criar outra.` };
  }

  const parsed = CreateWeekSchema.safeParse({
    referenceDate: formData.get("referenceDate"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }

  const dates = {
    referenceDate: new Date(parsed.data.referenceDate),
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
  };
  const dateError = validateOperationalWeekDates(dates);
  if (dateError) return { error: dateError };

  let week;
  try {
    week = await prisma.$transaction(async (tx) => {
      const created = await tx.week.create({
        data: {
          ...dates,
          notes: parsed.data.notes || null,
          status: "ABERTA",
        },
      });
      await writeAudit(
        { userId: user.id, action: "WEEK_CREATE", entityType: "Week", entityId: created.id, after: created },
        tx,
      );
      return created;
    });
  } catch {
    return { error: "Nao foi possivel criar a semana. Confirme se ja existe outra semana aberta." };
  }
  revalidatePath("/semanas");
  redirect(`/semanas/${week.id}`);
}

// CA-SEM-04
export async function closeWeek(weekId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireOperator();
    const result = await prisma.$transaction(async (tx) => {
      // O lock coordena o fechamento com os triggers de escrita operacional.
      await tx.$queryRaw`SELECT "id" FROM "weeks" WHERE "id" = ${weekId} FOR UPDATE`;
      const week = await tx.week.findUniqueOrThrow({ where: { id: weekId } });
      if (week.status === "FECHADA") return { ok: true };

      const [producerOrders, producerDeliveries, schoolOrders, schoolDeliveries] = await Promise.all([
        tx.producerOrder.findMany({
          where: { weekId },
          select: { producerId: true, productId: true, orderedQty: true },
        }),
        tx.producerDelivery.findMany({
          where: { weekId },
          select: { producerId: true, productId: true },
        }),
        tx.schoolOrder.findMany({
          where: { weekId },
          select: { schoolId: true, orderedQty: true },
        }),
        tx.schoolDelivery.findMany({ where: { weekId }, select: { schoolId: true } }),
      ]);
      const blockers = getWeekClosingBlockers({
        producerOrders: producerOrders.map((line) => ({ ...line, orderedQty: Number(line.orderedQty) })),
        producerDeliveries,
        schoolOrders: schoolOrders.map((line) => ({ ...line, orderedQty: Number(line.orderedQty) })),
        schoolDeliveries,
      });
      if (blockers.total > 0) {
        return {
          ok: false,
          error:
            `Nao e possivel fechar: ${blockers.pendingProducerDeliveries} entrega(s) de produtor ` +
            `e ${blockers.pendingSchoolDeliveries} entrega(s) de escola pendente(s).`,
        };
      }

      const updated = await tx.week.update({
        where: { id: weekId, status: "ABERTA" },
        data: { status: "FECHADA", closedAt: new Date(), closedById: user.id },
      });
      await writeAudit(
        {
          userId: user.id,
          action: "WEEK_CLOSE",
          entityType: "Week",
          entityId: weekId,
          before: week,
          after: updated,
        },
        tx,
      );
      return { ok: true };
    });
    if (!result.ok) return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Nao foi possivel fechar a semana." };
  }
  revalidatePath(`/semanas/${weekId}`);
  revalidatePath("/semanas");
  revalidatePath("/painel");
  return { ok: true };
}

const ReopenSchema = z.object({
  reason: z.string().trim().min(5, "Explique o motivo da reabertura (minimo 5 caracteres)"),
});

export interface ReopenFormState {
  error?: string;
}

// CA-SEM-06: reabertura exige usuario autorizado (ADMIN), e registra
// usuario + data/hora + motivo.
export async function reopenWeek(
  weekId: string,
  _prev: ReopenFormState,
  formData: FormData,
): Promise<ReopenFormState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = ReopenSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Motivo invalido" };
  }

  const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
  if (week.status !== "FECHADA") {
    return { error: "Esta semana nao esta fechada." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.week.update({
        where: { id: weekId, status: "FECHADA" },
        data: { status: "ABERTA", closedAt: null, closedById: null },
      });
      await tx.weekReopening.create({ data: { weekId, userId: user.id, reason: parsed.data.reason } });
      await writeAudit(
        {
          userId: user.id,
          action: "WEEK_REOPEN",
          entityType: "Week",
          entityId: weekId,
          before: week,
          after: updated,
          reason: parsed.data.reason,
        },
        tx,
      );
    });
  } catch {
    return { error: "Nao foi possivel reabrir. Confirme se nao existe outra semana aberta." };
  }
  revalidatePath(`/semanas/${weekId}`);
  revalidatePath("/semanas");
  return {};
}
