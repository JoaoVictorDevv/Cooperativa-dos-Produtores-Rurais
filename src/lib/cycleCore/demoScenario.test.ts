import { describe, expect, it } from "vitest";
import { summarizeCycle } from "../domain/cycle";
import { cycleInput, evaluateLedgerLine, ledgerClosingPreview } from "../domain/cycleLedger";
import { buildDemoLedger } from "./demoScenario";

describe("cenário fictício da demonstração", () => {
  it("abre em conferência, com falta sem decisão, pendência, excedente e sem poder fechar", () => {
    const ledger = buildDemoLedger();
    expect(summarizeCycle(cycleInput(ledger)).state).toBe("EM_CONFERENCIA");
    expect(evaluateLedgerLine(ledger, "EA", "alface")).toMatchObject({ acceptedQty: 170, shortageQty: 30, shortageStatus: "SEM_DECISAO" });
    expect(evaluateLedgerLine(ledger, "EB", "couve").receiptStatus).toBe("PENDENTE_CONFERENCIA");
    expect(evaluateLedgerLine(ledger, "EC", "cenoura").excessQty).toBe(5);
    expect(evaluateLedgerLine(ledger, "ED", "alface").receiptStatus).toBe("PENDENTE_CONFERENCIA");
    expect(ledgerClosingPreview(ledger).canClose).toBe(false);
  });
});
