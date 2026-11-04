import { describe, expect, it } from "vitest";
import { treasuryTotal, treasuryTotalPerLine } from "./calc";
import { perLineRoundingCutoff, treasuryRoundingFor } from "./roundingPolicy";

// 0,33 kg × R$ 10,05 = 3,3165 por linha.
const lines = Array.from({ length: 3 }, () => ({ orderedQty: 0.33, returnedQty: 0, price: 10.05 }));

describe("arredondamento do total a cobrar (decisão de 26/09/2026)", () => {
  it("ciclos novos: soma das linhas já arredondadas (3 × 3,32 = 9,96), como a planilha", () => {
    expect(treasuryTotalPerLine(lines)).toBe(9.96);
  });

  it("ciclos antigos: cálculo anterior preservado (arredonda só no fim = 9,95)", () => {
    expect(treasuryTotal(lines)).toBe(9.95);
  });

  it("o corte é a data de criação do ciclo; padrão 27/09/2026 00:00 de Brasília", () => {
    const cutoff = perLineRoundingCutoff({});
    expect(cutoff.toISOString()).toBe("2026-09-27T03:00:00.000Z");
    expect(treasuryRoundingFor({ createdAt: new Date("2026-09-27T02:59:59Z") }, cutoff)).toBe("TOTAL_LEGADO");
    expect(treasuryRoundingFor({ createdAt: new Date("2026-09-27T03:00:00Z") }, cutoff)).toBe("POR_LINHA");
    expect(treasuryRoundingFor({ createdAt: new Date("2026-09-16T12:00:00Z") }, cutoff)).toBe("TOTAL_LEGADO");
  });

  it("o corte pode ser ajustado por variável de ambiente; valor inválido volta ao padrão", () => {
    expect(perLineRoundingCutoff({ TREASURY_PER_LINE_ROUNDING_FROM: "2026-10-05T00:00:00-03:00" }).toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(perLineRoundingCutoff({ TREASURY_PER_LINE_ROUNDING_FROM: "amanhã" }).toISOString()).toBe("2026-09-27T03:00:00.000Z");
  });
});
