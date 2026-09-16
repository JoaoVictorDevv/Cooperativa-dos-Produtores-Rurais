"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { writeAudit } from "@/lib/audit";

const ScheduleSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().positive("Preco deve ser maior que zero"),
  validFrom: z.string().min(1, "Informe a data de vigencia"),
});

export interface PriceFormState {
  error?: string;
}

// CA-PRECO-02/03: nunca sobrescreve — fecha a linha vigente (validTo) e
// cria uma nova a partir da data informada. Pode ser uma data futura.
export async function schedulePriceChange(
  _prev: PriceFormState,
  formData: FormData,
): Promise<PriceFormState> {
  const user = await requireRole(["ADMIN"]);
  const parsed = ScheduleSchema.safeParse({
    productId: formData.get("productId"),
    price: formData.get("price"),
    validFrom: formData.get("validFrom"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" };
  }
  const { productId, price, validFrom } = parsed.data;
  const validFromDate = new Date(validFrom);

  const currentPrice = await prisma.price.findFirst({
    where: { productId, validTo: null },
    orderBy: { validFrom: "desc" },
  });
  if (currentPrice && validFromDate <= currentPrice.validFrom) {
    return { error: "A nova vigencia precisa ser depois do inicio do preco atual." };
  }

  await prisma.$transaction(async (tx) => {
    if (currentPrice) {
      await tx.price.update({ where: { id: currentPrice.id }, data: { validTo: validFromDate } });
    }
    const created = await tx.price.create({
      data: { productId, price, validFrom: validFromDate, validTo: null },
    });
    await writeAudit({
      userId: user.id,
      action: "PRICE_SCHEDULE",
      entityType: "Price",
      entityId: created.id,
      before: currentPrice,
      after: created,
    });
  });

  revalidatePath("/precos");
  return {};
}
