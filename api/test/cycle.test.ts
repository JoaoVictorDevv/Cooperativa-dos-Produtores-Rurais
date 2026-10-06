import { describe, expect, it } from "vitest";
import { acceptedAtWarehouse, producerPayable, schoolLineSummary } from "../src/domain/cycle.js";

describe("ciclo PNAE", () => {
  it("reproduz o exemplo obrigatório 200/180/170", () => {
    const warehouse = { grossQty: 200, rejectedQty: 20, price: 8, logisticsDeduction: 3.67 };
    expect(acceptedAtWarehouse(warehouse)).toBe(180);
    expect(producerPayable(warehouse)).toBe(779.4);

    expect(schoolLineSummary(200, 8, [{
      presentedQty: 180,
      rejectedQty: 10,
      lossBeforeSchoolQty: 0,
      sameTrip: false,
    }])).toEqual({
      acceptedQty: 170,
      rejectedQty: 10,
      lossBeforeSchoolQty: 0,
      shortageQty: 30,
      excessQty: 0,
      receivable: 1360,
    });
  });

  it("não soma o complemento da mesma viagem duas vezes", () => {
    expect(schoolLineSummary(200, 8, [
      { presentedQty: 200, rejectedQty: 0, lossBeforeSchoolQty: 0, sameTrip: false },
      { presentedQty: 30, rejectedQty: 0, lossBeforeSchoolQty: 0, sameTrip: true },
    ]).acceptedQty).toBe(200);
  });

  it("preserva vazio como pendente e zero como conferido", () => {
    expect(schoolLineSummary(30, 8, [{ presentedQty: null, rejectedQty: 0, lossBeforeSchoolQty: 0, sameTrip: false }]).acceptedQty).toBeNull();
    expect(schoolLineSummary(30, 8, [{ presentedQty: 0, rejectedQty: 0, lossBeforeSchoolQty: 0, sameTrip: false }]).acceptedQty).toBe(0);
  });
});
