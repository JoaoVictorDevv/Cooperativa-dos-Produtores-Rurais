import { describe, expect, it } from "vitest";
import { moneySchema, qtySchema } from "./validation";

describe("validação de quantidade e valor no servidor", () => {
  it("aceita zero, inteiros e até 2 casas (inclusive texto com ponto)", () => {
    for (const v of [0, 10, 12.5, 0.29, 1.1, "33.33", 99_999_999.99]) expect(qtySchema.safeParse(v).success).toBe(true);
  });
  it("recusa mais de 2 casas em vez de o banco arredondar em silêncio", () => {
    const r = qtySchema.safeParse(1.005);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Use no maximo 2 casas decimais");
  });
  it("recusa negativo, texto e valor acima da capacidade da coluna", () => {
    expect(qtySchema.safeParse(-1).success).toBe(false);
    expect(qtySchema.safeParse("abc").success).toBe(false);
    expect(qtySchema.safeParse(100_000_000).success).toBe(false);
    expect(moneySchema.safeParse(10_000_000_000).success).toBe(false);
  });
  it("valor em dinheiro também limita a 2 casas", () => {
    expect(moneySchema.safeParse(120.4).success).toBe(true);
    expect(moneySchema.safeParse(120.456).success).toBe(false);
  });
});
