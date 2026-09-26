import { describe, expect, it } from "vitest";
import { allocationKey, allocationPlanSignature, planOrdersFromAllocation, type AllocationPlanInput } from "./producerOrdersFromAllocation";

const products: AllocationPlanInput["products"] = [
  { id: "alface", name: "Alface lisa", unit: "kg", offered: true },
  { id: "couve", name: "Couve manteiga", unit: "kg", offered: true },
  { id: "ovos", name: "Ovos", unit: "dz", offered: false },
];

function input(partial: Partial<AllocationPlanInput>): AllocationPlanInput {
  return { products, allocations: [], orders: [], schoolDemand: [], ...partial };
}

const line = (plan: ReturnType<typeof planOrdersFromAllocation>, producerId: string, productId: string) =>
  plan.lines.find((l) => l.key === allocationKey(producerId, productId));

describe("gerar pedidos aos produtores a partir da divisão", () => {
  it("divisão sem pedido: propõe criar o pedido com o valor da divisão", () => {
    const plan = planOrdersFromAllocation(input({ allocations: [{ producerId: "A", productId: "alface", qty: 120 }] }));
    expect(line(plan, "A", "alface")).toMatchObject({ kind: "NOVO", currentOrderQty: null, resultingOrderQty: 120, willWrite: true });
    expect(plan.toWrite).toEqual([{ producerId: "A", productId: "alface", newQty: 120, currentQty: null }]);
    expect(plan.counts.create).toBe(1);
  });

  it("pedido registrado com zero conta como sem pedido e é atualizado (não duplica o registro)", () => {
    const plan = planOrdersFromAllocation(input({ allocations: [{ producerId: "A", productId: "alface", qty: 50 }], orders: [{ producerId: "A", productId: "alface", qty: 0 }] }));
    expect(plan.toWrite).toEqual([{ producerId: "A", productId: "alface", newQty: 50, currentQty: 0 }]);
    expect(plan.counts.update).toBe(1);
  });

  it("pedido igual à divisão: nada muda", () => {
    const plan = planOrdersFromAllocation(input({ allocations: [{ producerId: "A", productId: "alface", qty: 80 }], orders: [{ producerId: "A", productId: "alface", qty: 80 }] }));
    expect(line(plan, "A", "alface")?.kind).toBe("IGUAL");
    expect(plan.toWrite).toHaveLength(0);
  });

  it("pedido digitado diferente da divisão é mantido, salvo decisão explícita por linha", () => {
    const base = input({ allocations: [{ producerId: "A", productId: "alface", qty: 80 }], orders: [{ producerId: "A", productId: "alface", qty: 60 }] });
    const semDecisao = planOrdersFromAllocation(base);
    expect(line(semDecisao, "A", "alface")).toMatchObject({ kind: "DIFERENTE", resultingOrderQty: 60, willWrite: false });
    expect(semDecisao.toWrite).toHaveLength(0);
    const comDecisao = planOrdersFromAllocation(base, { replaceWithAllocation: { [allocationKey("A", "alface")]: true } });
    expect(comDecisao.toWrite).toEqual([{ producerId: "A", productId: "alface", newQty: 80, currentQty: 60 }]);
  });

  it("pedido sem divisão é mantido e listado, nunca apagado", () => {
    const plan = planOrdersFromAllocation(input({ orders: [{ producerId: "B", productId: "couve", qty: 30 }] }));
    expect(line(plan, "B", "couve")).toMatchObject({ kind: "SEM_DIVISAO", resultingOrderQty: 30, willWrite: false });
    expect(plan.toWrite).toHaveLength(0);
  });

  it("produto fora da oferta (Ovos) não gera pedido", () => {
    const plan = planOrdersFromAllocation(input({ allocations: [{ producerId: "A", productId: "ovos", qty: 10 }] }));
    expect(line(plan, "A", "ovos")?.kind).toBe("FORA_DA_OFERTA");
    expect(plan.toWrite).toHaveLength(0);
  });

  it("resumo por produto: demanda das escolas × divisão × pedidos antes e depois, sem misturar unidades", () => {
    const plan = planOrdersFromAllocation(
      input({
        schoolDemand: [
          { productId: "alface", qty: 200 },
          { productId: "couve", qty: 50 },
        ],
        allocations: [
          { producerId: "A", productId: "alface", qty: 120 },
          { producerId: "B", productId: "alface", qty: 60 },
        ],
        orders: [{ producerId: "B", productId: "alface", qty: 60 }],
      }),
    );
    const alface = plan.byProduct.find((p) => p.productId === "alface")!;
    expect(alface).toMatchObject({ unit: "kg", schoolDemand: 200, allocated: 180, orderedBefore: 60, orderedAfter: 180, gap: 20 });
    const couve = plan.byProduct.find((p) => p.productId === "couve")!;
    expect(couve).toMatchObject({ schoolDemand: 50, allocated: 0, orderedAfter: 0, gap: 50 });
  });

  it("confirmar de novo não duplica: depois de gerado, tudo fica IGUAL", () => {
    const allocations = [{ producerId: "A", productId: "alface", qty: 120 }];
    const first = planOrdersFromAllocation(input({ allocations }));
    const orders = first.toWrite.map((w) => ({ producerId: w.producerId, productId: w.productId, qty: w.newQty }));
    const second = planOrdersFromAllocation(input({ allocations, orders }));
    expect(second.toWrite).toHaveLength(0);
    expect(second.counts.IGUAL).toBe(1);
  });

  it("assinatura muda se o pedido atual mudar depois da prévia", () => {
    const allocations = [{ producerId: "A", productId: "alface", qty: 80 }];
    const decisions = { replaceWithAllocation: { [allocationKey("A", "alface")]: true as const } };
    const a = planOrdersFromAllocation(input({ allocations, orders: [{ producerId: "A", productId: "alface", qty: 60 }] }), decisions);
    const b = planOrdersFromAllocation(input({ allocations, orders: [{ producerId: "A", productId: "alface", qty: 70 }] }), decisions);
    expect(allocationPlanSignature(a)).not.toBe(allocationPlanSignature(b));
  });
});
