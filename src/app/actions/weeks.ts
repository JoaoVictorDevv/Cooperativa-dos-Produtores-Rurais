"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOperator, requireRole } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";
import { getOpenWeek } from "@/lib/week";

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

  const week = await prisma.week.create({
    data: {
      referenceDate: new Date(parsed.data.referenceDate),
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      notes: parsed.data.notes || null,
      status: "ABERTA",
    },
  });
  await writeAudit({ userId: user.id, action: "WEEK_CREATE", entityType: "Week", entityId: week.id, after: week });
  revalidatePath("/semanas");
  redirect(`/semanas/${week.id}`);
}

// CA-SEM-04
export async function closeWeek(weekId: string) {
  const user = await requireOperator();
  const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
  if (week.status === "FECHADA") return;

  const updated = await prisma.week.update({
    where: { id: weekId },
    data: { status: "FECHADA", closedAt: new Date(), closedById: user.id },
  });
  await writeAudit({
    userId: user.id,
    action: "WEEK_CLOSE",
    entityType: "Week",
    entityId: weekId,
    before: week,
    after: updated,
  });
  revalidatePath(`/semanas/${weekId}`);
  revalidatePath("/semanas");
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

  const updated = await prisma.week.update({
    where: { id: weekId },
    data: { status: "ABERTA", closedAt: null, closedById: null },
  });
  await prisma.weekReopening.create({ data: { weekId, userId: user.id, reason: parsed.data.reason } });
  await writeAudit({
    userId: user.id,
    action: "WEEK_REOPEN",
    entityType: "Week",
    entityId: weekId,
    before: week,
    after: updated,
    reason: parsed.data.reason,
  });
  revalidatePath(`/semanas/${weekId}`);
  revalidatePath("/semanas");
  return {};
}
