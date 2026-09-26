import { describe, expect, it } from "vitest";
import type { CycleLedger } from "../domain/cycleLedger";
import { InMemoryCycleCoreRepository } from "./repository";

const base: CycleLedger = {
  cycleId: "c1",
  status: "ABERTO",
  orders: [{ schoolId: "E1", productId: "alface", orderedQty: 200, unit: "kg", price: 14.62 }],
  warehouseReceipts: [],
  events: [],
  decisions: [],
  audit: [],
};
const ana = { id: "ana", role: "OPERADOR" as const };
const bia = { id: "bia", role: "OPERADOR" as const };
const inicial = { type: "REGISTRAR_ENTREGA_INICIAL" as const, idempotencyKey: "k1", schoolId: "E1", productId: "alface", presentedQty: 180, rejectedQty: 0 };

describe("repositório em memória (contrato da porta de persistência)", () => {
  it("duas pessoas com a mesma tela aberta: a segunda correção é recusada e não grava nada", async () => {
    const repo = new InMemoryCycleCoreRepository([base]);
    await repo.execute("c1", inicial, ana);
    const telaAna = await repo.load("c1");
    const telaBia = await repo.load("c1");
    const eventId = telaAna.events[0].id;
    const a = await repo.execute("c1", { type: "CORRIGIR_EVENTO", eventId, expectedVersion: telaAna.events[0].version, changes: { presentedQty: 190 }, reason: "Recontagem" }, ana);
    const b = await repo.execute("c1", { type: "CORRIGIR_EVENTO", eventId, expectedVersion: telaBia.events[0].version, changes: { presentedQty: 170 }, reason: "Outra recontagem" }, bia);
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: false, code: "CONFLITO" });
    const now = await repo.load("c1");
    expect(now.events[0]).toMatchObject({ presentedQty: 190, version: 2 });
    expect(now.audit).toHaveLength(2);
  });

  it("duplo clique no mesmo envio grava uma vez só", async () => {
    const repo = new InMemoryCycleCoreRepository([base]);
    const [x, y] = await Promise.all([repo.execute("c1", inicial, ana), repo.execute("c1", inicial, ana)]);
    expect([x.ok && x.effect, y.ok && y.effect].sort()).toEqual(["APLICADO", "JA_REGISTRADO"]);
    expect((await repo.load("c1")).events).toHaveLength(1);
  });

  it("comando recusado não altera o estado; o estado devolvido não é a referência interna", async () => {
    const repo = new InMemoryCycleCoreRepository([base]);
    const refused = await repo.execute("c1", { ...inicial, presentedQty: -5 }, ana);
    expect(refused.ok).toBe(false);
    const loaded = await repo.load("c1");
    loaded.events.push({ ...loaded.events[0] });
    expect((await repo.load("c1")).events).toHaveLength(0);
  });
});
