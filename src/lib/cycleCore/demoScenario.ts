// Cenário FICTÍCIO para a tela de demonstração de complementos e faltas.
// Nomes e números inventados (baseados nos exemplos obrigatórios do prompt v2
// §17). Nada aqui vem do banco nem é gravado nele.

import { executeCommand, type CycleCommand, type CycleLedger } from "../domain/cycleLedger";

export const DEMO_CYCLE_ID = "demonstracao";

export const DEMO_NAMES = {
  schools: { EA: "Escola Exemplo A", EB: "Escola Exemplo B", EC: "Escola Exemplo C", ED: "Escola Exemplo D" } as Record<string, string>,
  products: { alface: "Alface lisa", couve: "Couve manteiga", cenoura: "Cenoura" } as Record<string, string>,
  producers: {
    P1: "Produtor Exemplo 1",
    P2: "Produtor Exemplo 2",
    P3: "Produtor Exemplo 3",
    P4: "Produtor Exemplo 4",
    P5: "Produtor Exemplo 5 (sem recebimento no galpão)",
  } as Record<string, string>,
};

export const DEMO_REASONS = ["Motivo não identificado", "Produto murcho ou estragado", "Fora do padrão combinado", "Quantidade divergente do romaneio", "Avaria no transporte"];

export function buildDemoLedger(): CycleLedger {
  let ledger: CycleLedger = {
    cycleId: DEMO_CYCLE_ID,
    status: "ABERTO",
    orders: [
      { schoolId: "EA", productId: "alface", orderedQty: 200, unit: "kg", price: 14.62 },
      { schoolId: "EB", productId: "couve", orderedQty: 30, unit: "kg", price: 8.1 },
      { schoolId: "EC", productId: "cenoura", orderedQty: 50, unit: "kg", price: 5.4 },
      { schoolId: "ED", productId: "alface", orderedQty: 40, unit: "kg", price: 14.62 },
    ],
    warehouseReceipts: [
      { producerId: "P1", productId: "alface", grossQty: 200, rejectedQty: 20, unit: "kg", price: 14.62, logisticsDeductionSnapshot: 3.67 },
      { producerId: "P2", productId: "alface", grossQty: 70, rejectedQty: 0, unit: "kg", price: 14.62, logisticsDeductionSnapshot: 3.67 },
      { producerId: "P3", productId: "couve", grossQty: 20, rejectedQty: 0, unit: "kg", price: 8.1, logisticsDeductionSnapshot: 2.03 },
      { producerId: "P4", productId: "cenoura", grossQty: 60, rejectedQty: 5, unit: "kg", price: 5.4, logisticsDeductionSnapshot: 1.35 },
    ],
    events: [],
    decisions: [],
    audit: [],
  };
  const commands: CycleCommand[] = [
    // Exemplo obrigatório: 200 pedidos, 180 apresentados, 10 rejeitados → falta 30 sem decisão.
    {
      type: "REGISTRAR_ENTREGA_INICIAL",
      idempotencyKey: "demo-ea",
      schoolId: "EA",
      productId: "alface",
      presentedQty: 180,
      rejectedQty: 10,
      rejectionReason: "Produto murcho ou estragado",
      source: { type: "PRODUTOR", producerId: "P1" },
      deliveredAt: "2026-09-28T09:40",
      receivedBy: "Merendeira (exemplo)",
    },
    // Pedido 30, complemento de 20 e entrega inicial não registrada → pendente.
    { type: "REGISTRAR_COMPLEMENTO", idempotencyKey: "demo-eb", schoolId: "EB", productId: "couve", presentedQty: 20, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "P3" }, deliveredAt: "2026-09-29T10:15" },
    // Excedente visível, sem cortar.
    { type: "REGISTRAR_ENTREGA_INICIAL", idempotencyKey: "demo-ec", schoolId: "EC", productId: "cenoura", presentedQty: 55, rejectedQty: 0, source: { type: "PRODUTOR", producerId: "P4" }, deliveredAt: "2026-09-28T11:05" },
  ];
  let seq = 0;
  for (const command of commands) {
    const r = executeCommand(ledger, command, { id: "cenario", role: "ADMIN" }, { now: "2026-09-28T12:00:00-03:00", newId: () => `demo-${++seq}` });
    if (!r.ok) throw new Error(`Cenário de demonstração inválido: ${r.error}`);
    ledger = r.ledger;
  }
  return ledger;
}
