import { describe, expect, it } from "vitest";
import { getWeekClosingBlockers, validateOperationalWeekDates } from "./weekPolicy";

describe("SPEC-001 — datas da semana", () => {
  it("aceita referencia dentro do periodo", () => {
    expect(
      validateOperationalWeekDates({
        referenceDate: new Date("2026-09-13T00:00:00.000Z"),
        startDate: new Date("2026-09-13T00:00:00.000Z"),
        endDate: new Date("2026-09-15T00:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("rejeita periodo invertido", () => {
    expect(
      validateOperationalWeekDates({
        referenceDate: new Date("2026-09-14T00:00:00.000Z"),
        startDate: new Date("2026-09-15T00:00:00.000Z"),
        endDate: new Date("2026-09-13T00:00:00.000Z"),
      }),
    ).toContain("inicial");
  });

  it("rejeita referencia fora do periodo", () => {
    expect(
      validateOperationalWeekDates({
        referenceDate: new Date("2026-09-20T00:00:00.000Z"),
        startDate: new Date("2026-09-13T00:00:00.000Z"),
        endDate: new Date("2026-09-15T00:00:00.000Z"),
      }),
    ).toContain("referencia");
  });
});

describe("SPEC-001 — fechamento da semana", () => {
  it("conta pedidos de produtor e escolas sem entrega", () => {
    expect(
      getWeekClosingBlockers({
        producerOrders: [
          { producerId: "p1", productId: "a", orderedQty: 10 },
          { producerId: "p1", productId: "b", orderedQty: 0 },
          { producerId: "p2", productId: "a", orderedQty: 5 },
        ],
        producerDeliveries: [{ producerId: "p1", productId: "a" }],
        schoolOrders: [
          { schoolId: "e1", orderedQty: 10 },
          { schoolId: "e1", orderedQty: 2 },
          { schoolId: "e2", orderedQty: 4 },
        ],
        schoolDeliveries: [{ schoolId: "e1" }],
      }),
    ).toEqual({
      pendingProducerDeliveries: 1,
      pendingSchoolDeliveries: 1,
      total: 2,
    });
  });

  it("permite fechar quando todos os pedidos positivos possuem entrega", () => {
    expect(
      getWeekClosingBlockers({
        producerOrders: [{ producerId: "p1", productId: "a", orderedQty: 10 }],
        producerDeliveries: [{ producerId: "p1", productId: "a" }],
        schoolOrders: [{ schoolId: "e1", orderedQty: 10 }],
        schoolDeliveries: [{ schoolId: "e1" }],
      }).total,
    ).toBe(0);
  });
});

