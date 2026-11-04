// Gerar pedidos aos produtores a partir da divisão (docs/propostas-pendentes.md
// §6, prompt v2 §5). A divisão é planejamento; o pedido é o que foi emitido ao
// produtor. Esta regra só propõe — quem confirma é o operador — e nunca:
// sobrescreve em silêncio um pedido digitado diferente, apaga pedido sem
// divisão, cria pedido de produto fora da oferta ou mexe em entregas.

import { round2 } from "./calc";

export interface AllocationPlanInput {
  products: { id: string; name: string; unit: "kg" | "dz"; offered: boolean }[];
  allocations: { producerId: string; productId: string; qty: number }[];
  orders: { producerId: string; productId: string; qty: number }[];
  schoolDemand: { productId: string; qty: number }[];
}

export type AllocationLineKind = "NOVO" | "IGUAL" | "DIFERENTE" | "SEM_DIVISAO" | "FORA_DA_OFERTA";

export interface AllocationPlanLine {
  key: string;
  producerId: string;
  productId: string;
  allocatedQty: number;
  // null = não há pedido (nem registro zerado).
  currentOrderQty: number | null;
  kind: AllocationLineKind;
  // Valor do pedido depois de confirmar (com as decisões atuais).
  resultingOrderQty: number | null;
  willWrite: boolean;
}

export interface AllocationPlanDecisions {
  // Linhas DIFERENTE em que o operador escolheu usar o valor da divisão.
  replaceWithAllocation: Record<string, true>;
}

export interface AllocationPlan {
  lines: AllocationPlanLine[];
  toWrite: { producerId: string; productId: string; newQty: number; currentQty: number | null }[];
  byProduct: {
    productId: string;
    unit: "kg" | "dz";
    schoolDemand: number;
    allocated: number;
    orderedBefore: number;
    orderedAfter: number;
    // Demanda das escolas − pedidos aos produtores depois de confirmar.
    gap: number;
  }[];
  counts: Record<AllocationLineKind, number> & { create: number; update: number };
}

export const allocationKey = (producerId: string, productId: string) => `${producerId}:${productId}`;

export function planOrdersFromAllocation(input: AllocationPlanInput, decisions: AllocationPlanDecisions = { replaceWithAllocation: {} }): AllocationPlan {
  const product = new Map(input.products.map((p) => [p.id, p]));
  const allocation = new Map(input.allocations.map((a) => [allocationKey(a.producerId, a.productId), round2(a.qty)]));
  const order = new Map(input.orders.map((o) => [allocationKey(o.producerId, o.productId), round2(o.qty)]));
  const keys = [...new Set([...allocation.keys(), ...order.keys()])].sort();

  const lines: AllocationPlanLine[] = [];
  for (const key of keys) {
    const [producerId, productId] = key.split(":");
    const allocatedQty = allocation.get(key) ?? 0;
    const orderRow = order.get(key);
    const currentOrderQty = orderRow === undefined ? null : orderRow;
    const hasOrder = (currentOrderQty ?? 0) > 0;
    if (allocatedQty === 0 && !hasOrder) continue;

    let kind: AllocationLineKind;
    let resultingOrderQty = currentOrderQty;
    let willWrite = false;
    if (allocatedQty === 0) kind = "SEM_DIVISAO";
    else if (!product.get(productId)?.offered) kind = "FORA_DA_OFERTA";
    else if (!hasOrder) {
      kind = "NOVO";
      resultingOrderQty = allocatedQty;
      willWrite = true;
    } else if (currentOrderQty === allocatedQty) kind = "IGUAL";
    else {
      kind = "DIFERENTE";
      if (decisions.replaceWithAllocation[key]) {
        resultingOrderQty = allocatedQty;
        willWrite = true;
      }
    }
    lines.push({ key, producerId, productId, allocatedQty, currentOrderQty, kind, resultingOrderQty, willWrite });
  }

  const toWrite = lines
    .filter((l) => l.willWrite)
    .map((l) => ({ producerId: l.producerId, productId: l.productId, newQty: l.resultingOrderQty!, currentQty: l.currentOrderQty }));

  const productIds = [...new Set([...input.schoolDemand.filter((d) => d.qty > 0).map((d) => d.productId), ...lines.map((l) => l.productId)])];
  const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
  const byProduct = productIds
    .map((productId) => {
      const ls = lines.filter((l) => l.productId === productId);
      const demand = sum(input.schoolDemand.filter((d) => d.productId === productId).map((d) => d.qty));
      const orderedAfter = sum(ls.map((l) => l.resultingOrderQty ?? 0));
      return {
        productId,
        unit: product.get(productId)?.unit ?? "kg",
        schoolDemand: demand,
        allocated: sum(ls.map((l) => l.allocatedQty)),
        orderedBefore: sum(ls.map((l) => l.currentOrderQty ?? 0)),
        orderedAfter,
        gap: round2(demand - orderedAfter),
      };
    })
    .sort((a, b) => (product.get(a.productId)?.name ?? "").localeCompare(product.get(b.productId)?.name ?? ""));

  const counts = { NOVO: 0, IGUAL: 0, DIFERENTE: 0, SEM_DIVISAO: 0, FORA_DA_OFERTA: 0, create: 0, update: 0 };
  for (const l of lines) counts[l.kind]++;
  for (const w of toWrite) {
    if (w.currentQty === null) counts.create++;
    else counts.update++;
  }
  return { lines, toWrite, byProduct, counts };
}

// O servidor só grava se o que vai escrever for idêntico ao que foi mostrado.
export function allocationPlanSignature(plan: AllocationPlan): string {
  return plan.toWrite.map((w) => `${w.producerId}:${w.productId}=${w.newQty}<${w.currentQty ?? "-"}`).join("|");
}
