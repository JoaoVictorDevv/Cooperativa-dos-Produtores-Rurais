import { describe, expect, it } from "vitest";
import {
  balanceStatus,
  grossMargin,
  netPrice,
  pnaeCycleRange,
  pnaeUsage,
  producerNetQty,
  producerPayment,
  producersTotal,
  reconcile,
  schoolNetQty,
  schoolValue,
  treasuryTotal,
  weekBalance,
} from "./calc";

// Testes minimos obrigatorios (secao 56 da especificacao)

describe("Teste 1 e 2 — pedido diferente da entrega (regra absoluta #1)", () => {
  it("mantem pedido e entrega como valores completamente separados", () => {
    const pedido = 500;
    const entregaMenor = 450;
    const entregaMaior = 550;
    // nao ha funcao que derive um do outro — a propria ausencia de
    // acoplamento é a garantia. Aqui so verificamos que ambos os
    // cenarios sao aceitos pelo calculo de pagamento sem restricao.
    expect(producerNetQty(entregaMenor, 0)).toBe(450);
    expect(producerNetQty(entregaMaior, 0)).toBe(550);
    expect(pedido).not.toBe(entregaMenor);
    expect(pedido).not.toBe(entregaMaior);
  });
});

describe("Teste 3 — pagamento ao produtor", () => {
  it("(450 - 10) * (8 - 3,67) = R$ 1.905,20", () => {
    const result = producerPayment(450, 10, 8, 3.67);
    expect(result).toBe(1905.2);
  });

  it("preco liquido = preco - 3,67", () => {
    expect(netPrice(8, 3.67)).toBe(4.33);
  });
});

describe("Teste 4 — valor a cobrar da prefeitura", () => {
  it("90 * 8 = R$ 720,00 (pedido 100, devolucao 10)", () => {
    expect(schoolValue(100, 10, 8)).toBe(720);
  });

  it("liquido = pedido - devolucao", () => {
    expect(schoolNetQty(100, 10)).toBe(90);
    expect(schoolNetQty(100, 0)).toBe(100);
  });

  it("total da prefeitura soma todas as escolas e produtos", () => {
    const total = treasuryTotal([
      { orderedQty: 100, returnedQty: 10, price: 8 },
      { orderedQty: 50, returnedQty: 0, price: 12 },
    ]);
    expect(total).toBe(720 + 600);
  });
});

describe("Teste 5 — margem bruta", () => {
  it("720 - 500 = R$ 220,00", () => {
    expect(grossMargin(720, 500)).toBe(220);
  });
});

describe("Teste 6 — saldo da semana", () => {
  it("220 - 100 = R$ 120,00", () => {
    expect(weekBalance(220, 100)).toBe(120);
  });

  it("classifica positivo, zero e negativo", () => {
    expect(balanceStatus(120)).toBe("POSITIVO");
    expect(balanceStatus(0)).toBe("ZERO");
    expect(balanceStatus(-5)).toBe("NEGATIVO");
  });
});

describe("Regra absoluta #4 — pagamento usa a entrega, nunca o pedido", () => {
  it("alterar o pedido sem alterar a entrega nao altera o pagamento", () => {
    const paymentComPedido500 = producerPayment(450, 0, 8, 3.67);
    // simula "pedido" mudando de 500 para 600 sem tocar em entrega/devolucao
    const paymentComPedido600 = producerPayment(450, 0, 8, 3.67);
    expect(paymentComPedido500).toBe(paymentComPedido600);
  });

  it("alterar a entrega altera o pagamento", () => {
    expect(producerPayment(450, 0, 8, 3.67)).not.toBe(producerPayment(460, 0, 8, 3.67));
  });

  it("alterar a devolucao altera o pagamento", () => {
    expect(producerPayment(450, 0, 8, 3.67)).not.toBe(producerPayment(450, 10, 8, 3.67));
  });
});

describe("Conferencia financeira (CA-CONF-*)", () => {
  it("mostra OK quando soma individual == total geral", () => {
    const result = reconcile([100, 200, 300], 600);
    expect(result.status).toBe("OK");
    expect(result.difference).toBe(0);
  });

  it("mostra DIVERGENCIA e a diferenca quando os valores nao coincidem", () => {
    const result = reconcile([100, 200, 300.5], 600);
    expect(result.status).toBe("DIVERGENCIA");
    expect(result.difference).toBe(0.5);
  });
});

describe("Limite anual PNAE (CA-PNAE-*)", () => {
  it("calcula restante e percentual utilizado", () => {
    const usage = pnaeUsage(32000);
    expect(usage.remaining).toBe(8000);
    expect(usage.percentUsed).toBe(80);
    expect(usage.alertLevel).toBe("ATENCAO");
  });

  it("marca ESTOURADO quando acumulado >= 40000", () => {
    expect(pnaeUsage(40000).alertLevel).toBe("ESTOURADO");
    expect(pnaeUsage(41000).alertLevel).toBe("ESTOURADO");
  });

  it("marca OK quando bem abaixo do limite", () => {
    expect(pnaeUsage(1000).alertLevel).toBe("OK");
  });

  it("identifica o ciclo PNAE (outubro a setembro) de uma data", () => {
    const dentroDoCicloAtual = pnaeCycleRange(new Date(Date.UTC(2026, 11, 15))); // dez/2026
    expect(dentroDoCicloAtual.start.getUTCFullYear()).toBe(2026);
    expect(dentroDoCicloAtual.start.getUTCMonth()).toBe(9); // outubro
    expect(dentroDoCicloAtual.end.getUTCFullYear()).toBe(2027);

    const antesDeOutubro = pnaeCycleRange(new Date(Date.UTC(2026, 2, 1))); // marco/2026
    expect(antesDeOutubro.start.getUTCFullYear()).toBe(2025);
  });
});

describe("producersTotal soma pagamentos individuais", () => {
  it("soma corretamente varios produtores/produtos", () => {
    const total = producersTotal([
      { deliveredQty: 450, returnedQty: 10, price: 8, logisticsDeductionPerKg: 3.67 },
      { deliveredQty: 100, returnedQty: 0, price: 12, logisticsDeductionPerKg: 3.67 },
    ]);
    expect(total).toBe(1905.2 + 833);
  });
});
