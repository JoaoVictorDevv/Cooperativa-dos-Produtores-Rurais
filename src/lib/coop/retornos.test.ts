import { describe, expect, it } from "vitest";
import { lerRetornos } from "./retornos";

const escolas = [
  { codigo: "1005", nome: "Escola A" },
  { codigo: "1021", nome: "Escola B" },
  { codigo: "2033.2", nome: "Escola C" },
];
const produtos = ["Alface lisa", "Cheiro verde", "Couve manteiga", "Couve-flor"];
const enviado = (c: string, p: string) => (c === "1021" && p === "Couve-flor" ? 0 : 3);

describe("lerRetornos", () => {
  it("entende falta, recusa e quantidade", () => {
    const r = lerRetornos("1005 não veio cheiro verde\n1021 recusou alface 2kg, couve devolveu\n2033.2 alface veio 1,5", escolas, produtos, enviado);
    expect(r.naoEntendi).toEqual([]);
    expect(r.mudancas.map((m) => [m.codigo, m.produto, m.retorno])).toEqual([
      ["1005", "Cheiro verde", { recebido: 0 }],
      ["1021", "Alface lisa", { rejeitado: 2 }],
      ["1021", "Couve manteiga", { rejeitado: 3 }],
      ["2033.2", "Alface lisa", { recebido: 1.5 }],
    ]);
  });

  it("escola que não recebeu nada vira falta em tudo que saiu", () => {
    const r = lerRetornos("1021 não recebeu nada", escolas, produtos, enviado);
    expect(r.mudancas.map((m) => m.produto)).toEqual(["Alface lisa", "Cheiro verde", "Couve manteiga"]);
  });

  it("avisa o que não entendeu", () => {
    const r = lerRetornos("9999 não veio alface\nliceu tudo certo\n1005 tudo certo", escolas, produtos, enviado);
    expect(r.mudancas).toEqual([]);
    expect(r.naoEntendi).toHaveLength(3);
  });
});
