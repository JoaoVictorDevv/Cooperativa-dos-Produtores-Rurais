import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCEPTANCE_CASES, CALCULATION_CASES, runAcceptanceCase, runCalculationCase } from "./acceptanceCases";
import { acceptanceFiles } from "./acceptanceExport";
import { commandSchema } from "./commandSchema";

describe("pacote de aceitação (referência para a API Java)", () => {
  for (const c of ACCEPTANCE_CASES) {
    it(`${c.id}: ${c.titulo}`, () => {
      expect(runAcceptanceCase(c)).toEqual([]);
    });
  }

  for (const c of CALCULATION_CASES) {
    it(`cálculo ${c.id}: ${c.titulo}`, () => {
      expect(runCalculationCase(c)).toBe(c.esperado);
    });
  }

  it("todo comando dos casos é válido pelo contrato (JSON Schema vem do mesmo zod)", () => {
    for (const c of ACCEPTANCE_CASES) for (const s of c.passos) expect(commandSchema.safeParse(s.command).success, `${c.id} ${s.command.type}`).toBe(true);
  });

  it("o executor acusa expectativa errada (não é um teste que sempre passa)", () => {
    const wrong = { ...ACCEPTANCE_CASES[0], fechamento: { receivableTotal: 2924 } };
    expect(runAcceptanceCase(wrong)).toEqual(["fechamento receivableTotal=2485.4, esperado 2924"]);
  });

  it("docs/aceitacao está atualizado com os casos e o contrato (rode scripts/export-acceptance.ts)", () => {
    for (const [path, content] of Object.entries(acceptanceFiles())) expect(readFileSync(path, "utf8"), path).toBe(content);
  });
});
