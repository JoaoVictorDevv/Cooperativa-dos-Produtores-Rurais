import { describe, expect, it } from "vitest";
import { calcularSemana, dividirProduto, mesIndice } from "./motor";
import { arred, arredBaixo, kgMensagem } from "./numeros";
import type { Cadastro, Semana } from "./tipos";

// Cenário inventado e pequeno. A conferência com as semanas reais (20/10 e
// 26/10, ~22 mil valores iguais) é feita por scripts/coop/conferir-motor.ts,
// porque as planilhas reais não ficam no repositório.

function cadastro(): Cadastro {
  return {
    chamada: "01/2026",
    processo: "Proc. 6040/2026",
    taxaLogistica: 3.67,
    produtos: [
      { nome: "Alface lisa", preco: 14.62, unidade: "kg", doisDias: true },
      { nome: "Beterraba", preco: 9.87, unidade: "kg", doisDias: false },
    ],
    produtores: [
      { id: "PROD - A", nome: "Ana Teste", curto: "Ana", telefone: "(24) 99999-0001" },
      { id: "PROD - B", nome: "Bruno Teste", curto: "Bruno", telefone: null },
    ],
    escolas: [
      { codigo: "1", nome: "Escola Um", aba: "E1", bairro: "Centro", endereco: "", telefone: "" },
      { codigo: "2", nome: "Escola Dois", aba: "E2", bairro: "Centro", endereco: "", telefone: "" },
      { codigo: "3", nome: "Escola Três", aba: "E3", bairro: "Posse", endereco: "", telefone: "" },
    ],
    rotas: [
      { id: "SEG-1", dia: "SEG", titulo: "SEGUNDA-FEIRA — ROTA 1", saida: "", paradas: [{ codigo: "1", par: "1", sub: "", nomeMapa: "UM", bairro: "" }, { codigo: "2", par: "2", sub: "", nomeMapa: "DOIS", bairro: "" }] },
      { id: "TER-1", dia: "TER", titulo: "TERÇA-FEIRA — ROTA 1", saida: "", paradas: [{ codigo: "3", par: "1", sub: "", nomeMapa: "TRÊS", bairro: "" }] },
    ],
    capacidade: {
      "Alface lisa": { "PROD - A": [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "PROD - B": [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      Beterraba: { "PROD - B": [500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    },
    motivos: [{ codigo: "4", texto: "Mercadoria estragada" }],
    pesoCaixa: { grande: 4, pequena: 2 },
  };
}

function semana(extra: Partial<Semana> = {}): Semana {
  const cad = cadastro();
  return {
    data: "2026-10-26",
    referencia: "26/10/2026",
    entrega: 2,
    chamada: "01/2026",
    processo: "Proc. 6040/2026",
    diasGalpao: ["DOMINGO", "SEGUNDA"],
    pedidoEscolas: { "1": { "Alface lisa": 10, Beterraba: 20 }, "2": { "Alface lisa": 10 }, "3": { "Alface lisa": 20 } },
    capacidadeSemana: {},
    pedidoProdutorManual: {},
    entrega1: {},
    entrega2: {},
    extra: {},
    retornos: {},
    conferidoPrefeitura: {},
    romaneiosConferidos: true,
    custos: { transporte: 100, montagem: 0, administrativo: 0, administrativoFalta: 0, embalagens: 0, escritorio: 0, impostos: 0, contabilidade: 0, conselho: 0 },
    rotas: cad.rotas,
    regraPrimeiroDia: "corrigida",
    ...extra,
  };
}

describe("números como no Excel", () => {
  it("arredonda meio para cima, sem o erro de vírgula do JavaScript", () => {
    expect(arred(0.285)).toBe(0.29);
    expect(arred(1.005)).toBe(1.01);
    expect(arred(-2.345)).toBe(-2.35);
    expect(arredBaixo(2.999)).toBe(2.99);
    expect(kgMensagem(19.3)).toBe("19,30");
    expect(kgMensagem(200)).toBe("200");
  });

  it("mês da divisão: outubro = 1, setembro = 12", () => {
    expect(mesIndice("26/10/2026")).toBe(1);
    expect(mesIndice("08/11/2026")).toBe(2);
    expect(mesIndice("15/09/2027")).toBe(12);
    expect(mesIndice("")).toBe(0);
  });
});

describe("divisão do pedido (_AUX_DIVISAO)", () => {
  it("divide igual entre quem tem produção, sem passar da produção de cada um", () => {
    expect(dividirProduto(100, [0, 30, 200, 200])).toEqual([0, 30, 35, 35]);
  });
  it("arredondamento sobra para o de maior produção", () => {
    expect(dividirProduto(10, [100, 100, 100])).toEqual([3.34, 3.33, 3.33]);
  });
  it("pedido maior que a produção: cada um no máximo, falta fica sem dono", () => {
    expect(dividirProduto(500, [100, 50])).toEqual([100, 50]);
  });
  it("ninguém produz: ninguém recebe pedido", () => {
    expect(dividirProduto(50, [0, 0])).toEqual([0, 0]);
  });
});

describe("semana inteira", () => {
  it("chegou tudo: cada escola recebe o pedido e o produtor é pago pelo pedido", () => {
    const r = calcularSemana(cadastro(), semana({ entrega1: { "PROD - A": { "Alface lisa": 10 }, "PROD - B": { "Alface lisa": 10, Beterraba: 20 } }, entrega2: { "PROD - A": { "Alface lisa": 10 }, "PROD - B": { "Alface lisa": 10 } } }));
    expect(r.pedidoProdutor["PROD - A"]["Alface lisa"]).toBe(20);
    // Alface: metade do pedido é de segunda → 1º dia leva metade.
    expect(r.produtores["PROD - A"]["Alface lisa"].planejado1).toBe(10);
    expect(r.enviado["3"]["Alface lisa"]).toBe(20);
    expect(r.resumo.cobrar).toBe(arred(40 * 14.62) + arred(20 * 9.87));
    expect(r.pagarProdutor["PROD - A"]).toBe(arred(20 * (14.62 - 3.67)));
  });

  it("faltou no 1º dia: divide a falta entre as escolas da segunda, ninguém passa do pedido", () => {
    const r = calcularSemana(cadastro(), semana({ entrega1: { "PROD - A": { "Alface lisa": 5 }, "PROD - B": { "Alface lisa": 5, Beterraba: 20 } } }));
    expect(r.entregaProduto["Alface lisa"].fator1).toBe(0.5);
    expect(r.enviado["1"]["Alface lisa"] + r.enviado["2"]["Alface lisa"]).toBe(10);
    // Produtor pago só pelo que entregou (em branco no 2º dia = não lançado = 0 no pagamento).
    expect(r.produtores["PROD - A"]["Alface lisa"].pagoKg).toBe(5);
  });

  it("entrega extra cobre a falta na ordem da rota e o produtor recebe só o que foi usado", () => {
    const r = calcularSemana(
      cadastro(),
      semana({
        entrega1: { "PROD - A": { "Alface lisa": 5 }, "PROD - B": { "Alface lisa": 5, Beterraba: 20 } },
        entrega2: { "PROD - A": { "Alface lisa": 10 }, "PROD - B": { "Alface lisa": 10 } },
        extra: { "PROD - A": { "Alface lisa": 30 } },
      }),
    );
    expect(r.extraEscola["1"]["Alface lisa"]).toBe(5);
    expect(r.extraEscola["2"]["Alface lisa"]).toBe(5);
    expect(r.produtores["PROD - A"]["Alface lisa"].extraPago).toBe(10);
  });

  it("escola recebeu menos e rejeitou: cobra o aceito; Prefeitura conferida vale por cima", () => {
    const base = { entrega1: { "PROD - A": { "Alface lisa": 10 }, "PROD - B": { "Alface lisa": 10, Beterraba: 20 } }, entrega2: { "PROD - A": { "Alface lisa": 10 }, "PROD - B": { "Alface lisa": 10 } } };
    const r = calcularSemana(cadastro(), semana({ ...base, retornos: { "1": { "Alface lisa": { recebido: 8, rejeitado: 1, motivo: "4" } } } }));
    expect(r.fichas["1"]["Alface lisa"].cobrado).toBe(7);
    const r2 = calcularSemana(cadastro(), semana({ ...base, conferidoPrefeitura: { Beterraba: 15 } }));
    expect(r2.resumo.produtos[1].cobradoKg).toBe(15);
  });

  it("romaneios não conferidos: perdas aguardando", () => {
    const r = calcularSemana(cadastro(), semana({ romaneiosConferidos: false }));
    expect(r.resumo.perdas).toBeNull();
    expect(r.balanco.saldo).toBe(r.resumo.cobrar - r.resumo.pagar - 100);
  });
});
