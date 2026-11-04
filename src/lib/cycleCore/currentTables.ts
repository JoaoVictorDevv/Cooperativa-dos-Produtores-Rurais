// Leitura de um ciclo nas tabelas ATUAIS (Prisma) para o formato do núcleo
// (CycleLedger). Só lê. Traz o que já existe de verdade: pedidos das escolas
// com preço congelado, recebimento no galpão (bruto, rejeição, preço e
// desconto congelados), custos reais e nomes do cadastro.
//
// NÃO traz entregas por escola/produto nem decisões de falta: essas tabelas
// não existem (docs/propostas-pendentes.md §9). Por isso `events` e
// `decisions` saem vazios e nada aqui serve para cobrar pelo aceito na escola.

import type { PrismaClient } from "@prisma/client";
import { productUnit } from "../format";
import type { CycleLedger } from "../domain/cycleLedger";
import type { DocumentNames } from "./documents";

export interface CurrentCycle {
  week: { id: string; number: number; status: "ABERTA" | "FECHADA"; startDate: Date; endDate: Date; createdAt: Date };
  ledger: CycleLedger;
  names: DocumentNames;
  costs: { label: string; amount: number }[];
  // Devoluções no galpão sem entrega do mesmo produtor/produto: o modelo atual
  // as ignora no pagamento; o núcleo as trata como erro. Listadas à parte.
  returnsWithoutDelivery: { producerId: string; productId: string; qty: number }[];
}

type Db = Pick<PrismaClient, "week" | "schoolOrder" | "producerDelivery" | "producerReturn" | "weeklyCost">;

export async function loadCurrentCycle(db: Db, weekId: string): Promise<CurrentCycle | null> {
  const week = await db.week.findUnique({ where: { id: weekId } });
  if (!week) return null;
  const [orders, deliveries, returns, costs] = await Promise.all([
    db.schoolOrder.findMany({ where: { weekId }, include: { school: true, product: true, price: true } }),
    db.producerDelivery.findMany({ where: { weekId }, include: { producer: true, product: true, price: true } }),
    db.producerReturn.findMany({ where: { weekId }, include: { producer: true, product: true } }),
    db.weeklyCost.findMany({ where: { weekId } }),
  ]);

  const names: DocumentNames = { schools: {}, products: {}, producers: {} };
  for (const o of orders) {
    names.schools[o.schoolId] = o.school.name;
    names.products[o.productId] = o.product.name;
  }
  for (const d of [...deliveries, ...returns]) {
    names.producers[d.producerId] = d.producer.name;
    names.products[d.productId] = d.product.name;
  }

  const key = (p: string, q: string) => `${p}:${q}`;
  const returned = new Map<string, number>();
  for (const r of returns) returned.set(key(r.producerId, r.productId), (returned.get(key(r.producerId, r.productId)) ?? 0) + Number(r.returnedQty));
  const delivered = new Set(deliveries.map((d) => key(d.producerId, d.productId)));

  const ledger: CycleLedger = {
    cycleId: week.id,
    status: week.status === "ABERTA" ? "ABERTO" : "FECHADO",
    orders: orders.map((o) => ({ schoolId: o.schoolId, productId: o.productId, orderedQty: Number(o.orderedQty), unit: productUnit(o.product.slug), price: Number(o.price.price) })),
    warehouseReceipts: deliveries.map((d) => ({
      producerId: d.producerId,
      productId: d.productId,
      grossQty: Number(d.deliveredQty),
      rejectedQty: returned.get(key(d.producerId, d.productId)) ?? 0,
      unit: productUnit(d.product.slug),
      price: Number(d.price.price),
      logisticsDeductionSnapshot: Number(d.logisticsDeductionSnapshot),
    })),
    events: [],
    decisions: [],
    audit: [],
  };

  return {
    week: { id: week.id, number: week.number, status: week.status, startDate: week.startDate, endDate: week.endDate, createdAt: week.createdAt },
    ledger,
    names,
    costs: costs.map((c) => ({ label: c.category, amount: Number(c.amount) })),
    returnsWithoutDelivery: [...returned.entries()]
      .filter(([k]) => !delivered.has(k))
      .map(([k, qty]) => {
        const [producerId, productId] = k.split(":");
        return { producerId, productId, qty };
      }),
  };
}
