import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicErrorMessage } from "./publicError";
import { qtySchema } from "./validation";

const known = (code: string, message: string) => new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "test" });

describe("mensagem de erro para o navegador", () => {
  afterEach(() => vi.restoreAllMocks());

  it("erro de regra de negócio passa como está", () => {
    expect(publicErrorMessage(new Error("Rejeição maior que a entrega."), "x")).toBe("Rejeição maior que a entrega.");
  });

  it("erro interno do Prisma não vaza tabela, coluna nem valor; só o código vai ao log", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const msg = publicErrorMessage(known("P2003", 'Foreign key constraint failed on the field: `school_orders_priceId_fkey (index)` value 123'), "Erro ao salvar");
    expect(msg).toBe("Erro ao salvar (erro interno registrado).");
    expect(msg).not.toMatch(/school_orders|priceId|123/);
    expect(spy).toHaveBeenCalledWith("[erro interno do banco] P2003");
  });

  it("duplicidade e registro sumido viram orientação ao usuário", () => {
    expect(publicErrorMessage(known("P2002", "Unique constraint failed on the fields: (`weekId`,`schoolId`)"), "x")).toMatch(/já existe/);
    expect(publicErrorMessage(known("P2025", "Record to update not found."), "x")).toMatch(/não encontrado/);
  });

  it("gatilho de semana fechada mantém o sentido sem expor o id", () => {
    const e = new Prisma.PrismaClientUnknownRequestError("Raw query failed. Code: `P0001`. Message: `Semana fechada nao pode receber alteracoes: ckabc123`", { clientVersion: "test" });
    expect(publicErrorMessage(e, "x")).toBe("Semana fechada não pode receber alterações.");
  });

  it("erro de validação mostra só a mensagem da regra, não o JSON técnico", () => {
    const r = qtySchema.safeParse(-1);
    expect(publicErrorMessage(r.error, "x")).toBe("Quantidade nao pode ser negativa");
  });

  it("valor que não é Error usa o texto padrão", () => {
    expect(publicErrorMessage("boom", "Erro desconhecido")).toBe("Erro desconhecido");
  });
});
