"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/dal";
import { assertWeekEditable, getCurrentPrice } from "@/lib/week";
import { productUnit } from "@/lib/format";
import { isOfferedForNewEntries } from "@/lib/productPolicy";
import {
  allocationPlanSignature,
  planOrdersFromAllocation,
  type AllocationPlanDecisions,
  type AllocationPlanInput,
} from "@/lib/producerOrdersFromAllocation";

export interface AllocationPreviewResult {
  ok: boolean;
  error?: string;
  input?: AllocationPlanInput;
  producers?: { id: string; name: string; internalId: string }[];
}

async function loadInput(weekId: string): Promise<AllocationPlanInput> {
  const [products, allocations, orders, schoolOrders] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, slug: true, active: true } }),
    prisma.producerAllocation.findMany({ where: { weekId }, select: { producerId: true, productId: true, allocatedQty: true } }),
    prisma.producerOrder.findMany({ where: { weekId }, select: { producerId: true, productId: true, orderedQty: true } }),
    prisma.schoolOrder.groupBy({ by: ["productId"], where: { weekId }, _sum: { orderedQty: true } }),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, unit: productUnit(p.slug), offered: isOfferedForNewEntries(p) })),
    allocations: allocations.map((a) => ({ producerId: a.producerId, productId: a.productId, qty: Number(a.allocatedQty) })),
    orders: orders.map((o) => ({ producerId: o.producerId, productId: o.productId, qty: Number(o.orderedQty) })),
    schoolDemand: schoolOrders.map((s) => ({ productId: s.productId, qty: Number(s._sum.orderedQty ?? 0) })),
  };
}

async function loadEditableWeek(weekId: string) {
  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) throw new Error("Semana não encontrada.");
  assertWeekEditable(week);
  return week;
}

// Prévia: só lê. O navegador aplica as decisões e mostra o resultado.
export async function previewOrdersFromAllocation(weekId: string): Promise<AllocationPreviewResult> {
  try {
    await requireOperator();
    const week = await loadEditableWeek(weekId);
    const input = await loadInput(week.id);
    const producerIds = [...new Set([...input.allocations, ...input.orders].map((x) => x.producerId))];
    const producers = await prisma.producer.findMany({ where: { id: { in: producerIds } }, select: { id: true, name: true, internalId: true } });
    return { ok: true, input, producers };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao montar a prévia." };
  }
}

export interface AllocationConfirmResult {
  ok: boolean;
  error?: string;
  created?: number;
  updated?: number;
}

// Grava só se o plano recalculado agora (com a divisão e os pedidos atuais) for
// idêntico ao mostrado na prévia. Tudo numa transação; pedido alterado por
// outra pessoa no meio aborta tudo. Preço congelado na criação; atualização não
// troca o preço já registrado. Não toca em entregas.
export async function confirmOrdersFromAllocation(
  weekId: string,
  decisions: AllocationPlanDecisions,
  expectedSignature: string,
): Promise<AllocationConfirmResult> {
  try {
    const user = await requireOperator();
    const week = await loadEditableWeek(weekId);
    const safeDecisions: AllocationPlanDecisions = {
      replaceWithAllocation: Object.fromEntries(
        Object.entries(decisions?.replaceWithAllocation ?? {})
          .filter(([k, v]) => typeof k === "string" && v === true)
          .map(([k]) => [k, true as const]),
      ),
    };
    const plan = planOrdersFromAllocation(await loadInput(week.id), safeDecisions);
    if (allocationPlanSignature(plan) !== expectedSignature) {
      return { ok: false, error: "A divisão ou os pedidos mudaram depois da prévia. Gere a prévia de novo." };
    }
    if (plan.toWrite.length === 0) return { ok: false, error: "Nada a gerar: os pedidos já correspondem à divisão." };

    const productIds = [...new Set(plan.toWrite.filter((w) => w.currentQty === null).map((w) => w.productId))];
    const prices = new Map(await Promise.all(productIds.map(async (id) => [id, (await getCurrentPrice(id, week.referenceDate)).id] as const)));
    const reason = "Gerado a partir da divisão (prévia confirmada)";

    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.week.findUniqueOrThrow({ where: { id: week.id } });
        assertWeekEditable(current);
        let created = 0;
        let updated = 0;
        for (const w of plan.toWrite) {
          const where = { weekId_producerId_productId: { weekId: week.id, producerId: w.producerId, productId: w.productId } };
          if (w.currentQty === null) {
            const product = await tx.product.findUniqueOrThrow({ where: { id: w.productId } });
            if (!isOfferedForNewEntries(product)) throw new Error(`${product.name} está fora da oferta ativa.`);
            const saved = await tx.producerOrder.create({
              data: { weekId: week.id, producerId: w.producerId, productId: w.productId, orderedQty: w.newQty, priceId: prices.get(w.productId)! },
            });
            await tx.auditLog.create({
              data: { userId: user.id, action: "PRODUCER_ORDER_FROM_ALLOCATION_CREATE", entityType: "ProducerOrder", entityId: saved.id, after: { orderedQty: w.newQty }, reason },
            });
            created++;
          } else {
            const existing = await tx.producerOrder.findUniqueOrThrow({ where });
            const changed = await tx.producerOrder.updateMany({ where: { id: existing.id, orderedQty: w.currentQty }, data: { orderedQty: w.newQty } });
            if (changed.count !== 1) throw new Error("Um pedido foi alterado por outra pessoa depois da prévia. Gere a prévia de novo.");
            await tx.auditLog.create({
              data: {
                userId: user.id,
                action: "PRODUCER_ORDER_FROM_ALLOCATION_UPDATE",
                entityType: "ProducerOrder",
                entityId: existing.id,
                before: { orderedQty: w.currentQty },
                after: { orderedQty: w.newQty },
                reason,
              },
            });
            updated++;
          }
        }
        return { created, updated };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    revalidatePath("/produtores");
    revalidatePath(`/semanas/${week.id}`);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao gerar os pedidos." };
  }
}
