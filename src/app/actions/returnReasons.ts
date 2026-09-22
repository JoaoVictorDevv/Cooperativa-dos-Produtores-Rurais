"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";

const ReasonSchema = z.object({
  code: z.coerce.number().int().positive("Codigo deve ser positivo"),
  description: z.string().trim().min(2, "Descricao muito curta"),
});

export interface ReasonFormState {
  error?: string;
}

// CA-MOT-02: codigo unico.
export async function createReturnReason(_prev: ReasonFormState, formData: FormData): Promise<ReasonFormState> {
  const user = await requireRole(["ADMIN", "OPERADOR"]);
  const parsed = ReasonSchema.safeParse({ code: formData.get("code"), description: formData.get("description") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }

  const existing = await prisma.returnReason.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { error: `Ja existe o motivo de codigo ${parsed.data.code}.` };
  }

  await prisma.$transaction(async (tx) => {
    const reason = await tx.returnReason.create({ data: parsed.data });
    await writeAudit(
      {
        userId: user.id,
        action: "RETURN_REASON_CREATE",
        entityType: "ReturnReason",
        entityId: reason.id,
        after: reason,
      },
      tx,
    );
  });
  revalidatePath("/motivos");
  return {};
}

export async function setReturnReasonActive(id: string, active: boolean) {
  const user = await requireRole(["ADMIN", "OPERADOR"]);
  await prisma.$transaction(async (tx) => {
    const before = await tx.returnReason.findUniqueOrThrow({ where: { id } });
    const after = await tx.returnReason.update({ where: { id }, data: { active } });
    await writeAudit(
      {
        userId: user.id,
        action: active ? "RETURN_REASON_ACTIVATE" : "RETURN_REASON_DEACTIVATE",
        entityType: "ReturnReason",
        entityId: id,
        before,
        after,
      },
      tx,
    );
  });
  revalidatePath("/motivos");
}
