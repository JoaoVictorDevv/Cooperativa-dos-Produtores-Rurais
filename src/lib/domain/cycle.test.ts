import { describe, expect, it } from "vitest";
import { schoolNetQty } from "../calc";
import {
  attendanceRate,
  closingPreview,
  evaluateSchoolLine,
  evaluateWarehouseReceipt,
  producerPayable,
  schoolReceivable,
  summarizeCycle,
  summarizeSchools,
  warehouseToSchoolBalance,
  type SchoolLineInput,
} from "./cycle";

const ALFACE = "alface-lisa";

function exemploObrigatorio(extra: Partial<SchoolLineInput> = {}): SchoolLineInput {
  return {
    schoolId: "escola-1",
    productId: ALFACE,
    orderedQty: 200,
    events: [{ kind: "INICIAL", presentedQty: 180, rejectedQty: 10, sourceProducerId: "produtor-A" }],
    ...extra,
  };
}

describe("spec 008 — exemplo obrigatório 200 / 180 / 170", () => {
  const galpao = evaluateWarehouseReceipt({ producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20 });
  const escola = evaluateSchoolLine(exemploObrigatorio());

  it("paga o produtor por 180 (aceito no galpão)", () => {
    expect(galpao.status).toBe("CONFERIDO");
    expect(galpao.acceptedQty).toBe(180);
    expect(producerPayable(180, 14.62, 3.67)).toBe(1971); // 180 × 10,95
  });

  it("cobra a prefeitura por 170 (aceito na escola)", () => {
    expect(escola.acceptedQty).toBe(170);
    expect(schoolReceivable(escola.acceptedQty, 14.62)).toBe(2485.4);
  });

  it("falta 30, perda escolar 10, rejeição no galpão 20 — cada uma no seu lugar", () => {
    expect(escola.shortageQty).toBe(30);
    expect(escola.rejectedAtSchoolQty).toBe(10);
    expect(galpao.rejectedQty).toBe(20);
    expect(escola.lossBeforeSchoolQty).toBe(0); // falta não vira perda
  });

  it("a fórmula antiga (pedido − devolução) dá 190 — por isso não serve para o novo fluxo", () => {
    expect(schoolNetQty(200, 10)).toBe(190);
    expect(escola.acceptedQty).not.toBe(schoolNetQty(200, 10));
  });

  it("rejeição escolar nunca reduz o pagamento do produtor", () => {
    const summary = summarizeCycle({
      schoolLines: [exemploObrigatorio()],
      warehouseReceipts: [{ producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20 }],
    });
    expect(summary.totalsByUnit.kg!.acceptedAtWarehouseQty).toBe(180);
    expect(summary.totalsByUnit.kg!.acceptedAtSchoolQty).toBe(170);
  });

  it("falta de 30 sem decisão impede o ciclo de ficar pronto para fechar", () => {
    expect(escola.receiptStatus).toBe("CONFERIDO");
    expect(escola.valueCalculable).toBe(true);
    expect(escola.shortageStatus).toBe("SEM_DECISAO");
    expect(escola.readyToClose).toBe(false);
    expect(escola.blockers).toContain("FALTA_SEM_DECISAO");
  });
});

describe("spec 008 — complemento no mesmo ciclo", () => {
  const comComplemento = exemploObrigatorio({
    events: [
      { kind: "INICIAL", presentedQty: 180, rejectedQty: 10, sourceProducerId: "produtor-A" },
      { kind: "COMPLEMENTO", presentedQty: 30, rejectedQty: 0, sourceProducerId: "produtor-B" },
    ],
  });

  it("escola totaliza 200 aceitos, sem falta, e a perda original de 10 continua registrada", () => {
    const line = evaluateSchoolLine(comComplemento);
    expect(line.acceptedQty).toBe(200);
    expect(line.shortageQty).toBe(0);
    expect(line.rejectedAtSchoolQty).toBe(10);
    expect(line.attendance).toBe("OK");
    expect(line.readyToClose).toBe(true);
  });

  it("fornecedor original mantém 180; o do complemento tem o recebimento próprio", () => {
    const summary = summarizeCycle({
      schoolLines: [comComplemento],
      warehouseReceipts: [
        { producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20 },
        { producerId: "produtor-B", productId: ALFACE, grossQty: 30, rejectedQty: 0 },
      ],
    });
    const [a, b] = summary.warehouseReceipts;
    expect(a.result.acceptedQty).toBe(180);
    expect(b.result.acceptedQty).toBe(30);
    expect(summary.totalsByUnit.kg!.acceptedAtSchoolQty).toBe(200);
    expect(summary.totalsByUnit.kg!.rejectedAtSchoolQty).toBe(10);
    expect(schoolReceivable(summary.totalsByUnit.kg!.acceptedAtSchoolQty, 14.62)).toBe(2924); // cobra 200 uma vez só
    expect(summary.state).toBe("PRONTO_PARA_FECHAR");
  });

  it("uma falta encerrada que depois foi coberta por complemento vira decisão incoerente", () => {
    const line = evaluateSchoolLine({
      ...comComplemento,
      shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "sem produto", shortageQtyAtDecision: 30 },
    });
    expect(line.shortageStatus).toBe("DECISAO_INCOERENTE");
    expect(line.readyToClose).toBe(false);
  });
});

describe("spec 008 — falta encerrada sem atendimento", () => {
  it("encerra em 170 com falta final de 30 e libera o fechamento", () => {
    const line = evaluateSchoolLine(
      exemploObrigatorio({ shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "Sem alface no mercado", shortageQtyAtDecision: 30 } }),
    );
    expect(line.shortageStatus).toBe("ENCERRADA_SEM_ATENDIMENTO");
    expect(line.shortageQty).toBe(30);
    expect(line.acceptedQty).toBe(170);
    expect(line.readyToClose).toBe(true);
  });

  it("a decisão fica incoerente se a falta mudar depois (ex.: nova rejeição)", () => {
    const line = evaluateSchoolLine(
      exemploObrigatorio({
        events: [{ kind: "INICIAL", presentedQty: 180, rejectedQty: 20 }],
        shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "Sem alface", shortageQtyAtDecision: 30 },
      }),
    );
    expect(line.shortageQty).toBe(40);
    expect(line.shortageStatus).toBe("DECISAO_INCOERENTE");
  });

  it("encerramento exige motivo", () => {
    const line = evaluateSchoolLine(
      exemploObrigatorio({ shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "  ", shortageQtyAtDecision: 30 } }),
    );
    expect(line.shortageStatus).toBe("DECISAO_INCOERENTE");
  });

  it("falta 'em resolução' continua bloqueando", () => {
    const line = evaluateSchoolLine(exemploObrigatorio({ shortageDecision: { kind: "EM_RESOLUCAO" } }));
    expect(line.shortageStatus).toBe("EM_RESOLUCAO");
    expect(line.readyToClose).toBe(false);
  });

  it("não existe atalho 'resolvida': sem complemento, a falta numérica continua", () => {
    const line = evaluateSchoolLine(exemploObrigatorio());
    expect(line.shortageQty).toBe(30);
    expect(["SEM_DECISAO", "EM_RESOLUCAO", "ENCERRADA_SEM_ATENDIMENTO", "DECISAO_INCOERENTE"]).toContain(line.shortageStatus);
  });
});

describe("spec 008 — vazio × zero confirmado × pedido zero", () => {
  it("pedido com recebimento não informado fica pendente, nunca zero", () => {
    const line = evaluateSchoolLine({ schoolId: "e", productId: ALFACE, orderedQty: 30, events: [{ kind: "INICIAL", presentedQty: null, rejectedQty: 0 }] });
    expect(line.receiptStatus).toBe("PENDENTE_CONFERENCIA");
    expect(line.valueCalculable).toBe(false);
    expect(line.shortageStatus).toBe("NAO_APLICAVEL");
    expect(line.blockers).toContain("RECEBIMENTO_NAO_CONFERIDO");
  });

  it("pedido sem nenhum evento de entrega também fica pendente", () => {
    const line = evaluateSchoolLine({ schoolId: "e", productId: ALFACE, orderedQty: 30, events: [] });
    expect(line.receiptStatus).toBe("PENDENTE_CONFERENCIA");
    expect(line.blockers).toContain("ENTREGA_INICIAL_NAO_INFORMADA");
  });

  it("entrega zero confirmada é conferência feita: falta integral, precisa de decisão", () => {
    const line = evaluateSchoolLine({ schoolId: "e", productId: ALFACE, orderedQty: 30, events: [{ kind: "INICIAL", presentedQty: 0, rejectedQty: 0 }] });
    expect(line.receiptStatus).toBe("CONFERIDO");
    expect(line.shortageQty).toBe(30);
    expect(line.shortageStatus).toBe("SEM_DECISAO");
  });

  it("pedido zero sem movimento não bloqueia nada", () => {
    const line = evaluateSchoolLine({ schoolId: "e", productId: ALFACE, orderedQty: 0, events: [] });
    expect(line.receiptStatus).toBe("SEM_PEDIDO");
    expect(line.readyToClose).toBe(true);
  });

  it("pedido 30, complemento de 20 aceito e inicial vazio: pendente; confirmando zero inicial, falta 10", () => {
    const base = { schoolId: "e", productId: ALFACE, orderedQty: 30 };
    const pendente = evaluateSchoolLine({
      ...base,
      events: [
        { kind: "INICIAL", presentedQty: null, rejectedQty: 0 },
        { kind: "COMPLEMENTO", presentedQty: 20, rejectedQty: 0 },
      ],
    });
    expect(pendente.receiptStatus).toBe("PENDENTE_CONFERENCIA");
    expect(pendente.readyToClose).toBe(false);

    const confirmado = evaluateSchoolLine({
      ...base,
      events: [
        { kind: "INICIAL", presentedQty: 0, rejectedQty: 0 },
        { kind: "COMPLEMENTO", presentedQty: 20, rejectedQty: 0 },
      ],
    });
    expect(confirmado.receiptStatus).toBe("CONFERIDO");
    expect(confirmado.shortageQty).toBe(10);
  });

  it("galpão: vazio é não conferido; zero é zero confirmado; ausência de entrega não é rejeição", () => {
    expect(evaluateWarehouseReceipt({ producerId: "p", productId: ALFACE, grossQty: null, rejectedQty: 0 }).status).toBe("NAO_CONFERIDO");
    const zero = evaluateWarehouseReceipt({ producerId: "p", productId: ALFACE, grossQty: 0, rejectedQty: 0 });
    expect(zero.status).toBe("CONFERIDO");
    expect(zero.acceptedQty).toBe(0);
    expect(evaluateWarehouseReceipt({ producerId: "p", productId: ALFACE, grossQty: null, rejectedQty: 5 }).status).toBe("ERRO");
  });
});

describe("spec 008 — limites e erros", () => {
  it("rejeição no galpão limitada à entrega bruta", () => {
    const r = evaluateWarehouseReceipt({ producerId: "p", productId: ALFACE, grossQty: 10, rejectedQty: 11 });
    expect(r.status).toBe("ERRO");
  });

  it("rejeição na escola limitada à quantidade apresentada (não ao pedido)", () => {
    const ok = evaluateSchoolLine({ schoolId: "e", productId: ALFACE, orderedQty: 5, events: [{ kind: "INICIAL", presentedQty: 12, rejectedQty: 8 }] });
    expect(ok.receiptStatus).toBe("CONFERIDO"); // 8 > pedido 5, mas ≤ apresentado 12
    const erro = evaluateSchoolLine({ schoolId: "e", productId: ALFACE, orderedQty: 50, events: [{ kind: "INICIAL", presentedQty: 12, rejectedQty: 13 }] });
    expect(erro.receiptStatus).toBe("ERRO");
    expect(erro.blockers).toContain("ERRO_DE_VALIDACAO");
  });

  it("duas entregas iniciais para a mesma escola/produto é erro (correção ≠ nova entrega)", () => {
    const line = evaluateSchoolLine({
      schoolId: "e",
      productId: ALFACE,
      orderedQty: 10,
      events: [
        { kind: "INICIAL", presentedQty: 5, rejectedQty: 0 },
        { kind: "INICIAL", presentedQty: 5, rejectedQty: 0 },
      ],
    });
    expect(line.receiptStatus).toBe("ERRO");
  });
});

describe("spec 008 — perda antes da escola × rejeição escolar × saldo a conferir", () => {
  it("perda de transporte fica separada da rejeição escolar e não reduz o produtor", () => {
    const line = evaluateSchoolLine({
      schoolId: "e",
      productId: ALFACE,
      orderedQty: 200,
      events: [{ kind: "INICIAL", presentedQty: 175, rejectedQty: 10, lossBeforeSchoolQty: 5 }],
    });
    expect(line.lossBeforeSchoolQty).toBe(5);
    expect(line.rejectedAtSchoolQty).toBe(10);
    expect(line.acceptedQty).toBe(165);
    expect(warehouseToSchoolBalance(180, 175, 5)).toBe(0);
  });

  it("saldo positivo entre galpão e escolas é 'a conferir', não perda", () => {
    expect(warehouseToSchoolBalance(180, 150, 0)).toBe(30);
  });
});

describe("spec 008 — excedente não compensa falta de outra linha", () => {
  it("excesso numa escola e falta em outra ficam ambos visíveis", () => {
    const summary = summarizeCycle({
      schoolLines: [
        { schoolId: "e1", productId: ALFACE, orderedQty: 10, events: [{ kind: "INICIAL", presentedQty: 15, rejectedQty: 0 }] },
        { schoolId: "e2", productId: ALFACE, orderedQty: 10, events: [{ kind: "INICIAL", presentedQty: 5, rejectedQty: 0 }] },
      ],
      warehouseReceipts: [],
    });
    expect(summary.totalsByUnit.kg!.excessQty).toBe(5);
    expect(summary.totalsByUnit.kg!.shortageQty).toBe(5);
    expect(summary.counts.shortagesWithoutDecision).toBe(1);
    expect(attendanceRate(summary.schoolLines)).toBe(75); // (10 + 5) / 20 — excesso não soma
  });

  it("percentual com demanda zero é não aplicável", () => {
    expect(attendanceRate([{ orderedQty: 0, acceptedQty: 3 }])).toBeNull();
  });
});

describe("spec 008 — estados do ciclo", () => {
  it("ciclo sem pedido e sem movimento: aguardando pedido (não 'tudo conferido')", () => {
    const s = summarizeCycle({ schoolLines: [], warehouseReceipts: [] });
    expect(s.state).toBe("AGUARDANDO_PEDIDO");
    expect(s.readyToClose).toBe(false);
    expect(s.valuesCalculated).toBe(false);
  });

  it("recebimento não conferido no galpão: em conferência", () => {
    const s = summarizeCycle({
      schoolLines: [exemploObrigatorio({ shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "x", shortageQtyAtDecision: 30 } })],
      warehouseReceipts: [{ producerId: "p", productId: ALFACE, grossQty: null, rejectedQty: 0 }],
    });
    expect(s.state).toBe("EM_CONFERENCIA");
    expect(s.receiptsConferred).toBe(false);
  });

  it("conferido e calculado, mas falta sem decisão: aguardando decisões", () => {
    const s = summarizeCycle({
      schoolLines: [exemploObrigatorio()],
      warehouseReceipts: [{ producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20 }],
    });
    expect(s.receiptsConferred).toBe(true);
    expect(s.valuesCalculated).toBe(true);
    expect(s.readyToClose).toBe(false);
    expect(s.state).toBe("AGUARDANDO_DECISOES");
  });

  it("erro real bloqueia com estado próprio", () => {
    const s = summarizeCycle({
      schoolLines: [{ schoolId: "e", productId: ALFACE, orderedQty: 5, events: [{ kind: "INICIAL", presentedQty: 2, rejectedQty: 3 }] }],
      warehouseReceipts: [],
    });
    expect(s.state).toBe("COM_ERROS");
  });

  it("pronto para fechar só com tudo conferido e faltas decididas", () => {
    const s = summarizeCycle({
      schoolLines: [exemploObrigatorio({ shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "Sem produto", shortageQtyAtDecision: 30 } })],
      warehouseReceipts: [{ producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20 }],
    });
    expect(s.state).toBe("PRONTO_PARA_FECHAR");
    expect(s.totalsByUnit.kg!.shortageClosedQty).toBe(30);
  });
});

describe("spec 008 — unidades nunca se misturam (kg × dz)", () => {
  it("totais e atendimento são separados por unidade", () => {
    const s = summarizeCycle({
      schoolLines: [
        { schoolId: "e", productId: ALFACE, unit: "kg", orderedQty: 10, events: [{ kind: "INICIAL", presentedQty: 10, rejectedQty: 0 }] },
        { schoolId: "e", productId: "ovos", unit: "dz", orderedQty: 5, events: [{ kind: "INICIAL", presentedQty: 3, rejectedQty: 0 }] },
      ],
      warehouseReceipts: [
        { producerId: "p", productId: ALFACE, unit: "kg", grossQty: 10, rejectedQty: 0 },
        { producerId: "q", productId: "ovos", unit: "dz", grossQty: 3, rejectedQty: 0 },
      ],
    });
    expect(s.totalsByUnit.kg!.orderedQty).toBe(10);
    expect(s.totalsByUnit.dz!.orderedQty).toBe(5);
    expect(s.totalsByUnit.dz!.shortageQty).toBe(2);
    expect(s.totalsByUnit.kg!.acceptedAtWarehouseQty).toBe(10);
    expect(s.totalsByUnit.dz!.acceptedAtWarehouseQty).toBe(3);
    expect(s.attendanceByUnit).toEqual({ kg: 100, dz: 60 });
  });
});

describe("spec 008 — situação por escola: entrega registrada ≠ pedido atendido", () => {
  const line = (schoolId: string, orderedQty: number, presented: number | null, extra: object = {}) => ({
    schoolId,
    productId: ALFACE,
    orderedQty,
    events: [{ kind: "INICIAL" as const, presentedQty: presented, rejectedQty: 0 }],
    ...extra,
  });
  const byId = (lines: Parameters<typeof summarizeCycle>[0]["schoolLines"]) =>
    Object.fromEntries(summarizeSchools(summarizeCycle({ schoolLines: lines, warehouseReceipts: [] }).schoolLines).map((x) => [x.schoolId, x]));

  it("classifica cada escola nas duas dimensões", () => {
    const r = byId([
      line("atendida", 10, 10),
      line("parcial", 10, 6),
      line("nada", 10, 0),
      line("pendente", 10, null),
      { schoolId: "sem-pedido", productId: ALFACE, orderedQty: 0, events: [] },
    ]);
    expect([r.atendida.delivery, r.atendida.attendance]).toEqual(["ENTREGA_REGISTRADA", "ATENDIDO"]);
    expect([r.parcial.delivery, r.parcial.attendance]).toEqual(["ENTREGA_REGISTRADA", "ATENDIMENTO_PARCIAL"]);
    expect([r.nada.delivery, r.nada.attendance]).toEqual(["ENTREGA_REGISTRADA", "NAO_ATENDIDO"]);
    expect([r.pendente.delivery, r.pendente.attendance]).toEqual(["PENDENTE_CONFERENCIA", "A_CONFERIR"]);
    expect([r["sem-pedido"].delivery, r["sem-pedido"].attendance]).toEqual(["SEM_PEDIDO", "SEM_PEDIDO"]);
  });

  it("entrega registrada com falta encerrada fica pronta para fechar, mas não 'atendida'", () => {
    const r = byId([line("e", 10, 6, { shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "sem produto", shortageQtyAtDecision: 4 } })]);
    expect(r.e.attendance).toBe("ATENDIMENTO_PARCIAL");
    expect(r.e.shortagesClosedWithoutService).toBe(1);
    expect(r.e.readyToClose).toBe(true);
  });
});

describe("spec 008 — prévia de fechamento (a cobrar, a pagar, faltas encerradas)", () => {
  const PRICE = 14.62;
  const DED = 3.67;
  const base = {
    schoolLines: [
      exemploObrigatorio({ price: PRICE, shortageDecision: { kind: "ENCERRADA_SEM_ATENDIMENTO", reason: "Sem alface no mercado", shortageQtyAtDecision: 30 } }),
    ],
    warehouseReceipts: [{ producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20, price: PRICE, logisticsDeductionSnapshot: DED }],
  };

  it("exemplo obrigatório: cobra 170 × preço, paga 180 × (preço − desconto), lista a falta encerrada", () => {
    const p = closingPreview(base);
    expect(p.canClose).toBe(true);
    expect(p.receivableTotal).toBe(2485.4); // 170 × 14,62
    expect(p.payableTotal).toBe(1971); // 180 × 10,95
    expect(p.calculatedResult).toBe(514.4);
    expect(p.closedShortages).toEqual([{ schoolId: "escola-1", productId: ALFACE, unit: "kg", qty: 30, reason: "Sem alface no mercado" }]);
    expect(p.totalsByUnit.kg!.rejectedAtWarehouseQty).toBe(20);
    expect(p.totalsByUnit.kg!.rejectedAtSchoolQty).toBe(10);
  });

  it("falta sem decisão bloqueia e diz por quê; os valores continuam visíveis", () => {
    const p = closingPreview({ ...base, schoolLines: [exemploObrigatorio({ price: PRICE })] });
    expect(p.canClose).toBe(false);
    expect(p.blockers).toContain("1 falta(s) sem decisão.");
    expect(p.receivableTotal).toBe(2485.4);
  });

  it("recebimento não conferido e preço ausente bloqueiam; linha pendente não entra no valor", () => {
    const p = closingPreview({
      schoolLines: [{ schoolId: "e", productId: ALFACE, orderedQty: 10, price: PRICE, events: [{ kind: "INICIAL", presentedQty: null, rejectedQty: 0 }] }],
      warehouseReceipts: [{ producerId: "p", productId: ALFACE, grossQty: 10, rejectedQty: 0 }],
    });
    expect(p.canClose).toBe(false);
    expect(p.blockers).toEqual(expect.arrayContaining(["1 item(ns) de escola sem conferência.", "1 recebimento(s) sem preço/desconto congelado."]));
    expect(p.receivableTotal).toBe(0);
  });

  it("total = soma das linhas arredondadas (tela, PDF e total batem)", () => {
    const lines = Array.from({ length: 3 }, (_, i) => ({
      schoolId: `e${i}`,
      productId: ALFACE,
      orderedQty: 0.33,
      price: 10.05,
      events: [{ kind: "INICIAL" as const, presentedQty: 0.33, rejectedQty: 0 }],
    }));
    const p = closingPreview({ schoolLines: lines, warehouseReceipts: [] });
    // 0,33 × 10,05 = 3,3165 → 3,32 por linha; 3 × 3,32 = 9,96 (arredondar só no fim daria 9,95)
    expect(p.receivableLines.map((l) => l.value)).toEqual([3.32, 3.32, 3.32]);
    expect(p.receivableTotal).toBe(9.96);
  });

  it("complemento de outro produtor: cada produtor recebe pelo seu aceito; escola cobra 200 uma vez", () => {
    const p = closingPreview({
      schoolLines: [
        exemploObrigatorio({
          price: PRICE,
          events: [
            { kind: "INICIAL", presentedQty: 180, rejectedQty: 10 },
            { kind: "COMPLEMENTO", presentedQty: 30, rejectedQty: 0, sourceProducerId: "produtor-B" },
          ],
        }),
      ],
      warehouseReceipts: [
        { producerId: "produtor-A", productId: ALFACE, grossQty: 200, rejectedQty: 20, price: PRICE, logisticsDeductionSnapshot: DED },
        { producerId: "produtor-B", productId: ALFACE, grossQty: 30, rejectedQty: 0, price: PRICE, logisticsDeductionSnapshot: DED },
      ],
    });
    expect(p.receivableTotal).toBe(2924); // 200 × 14,62
    expect(p.payableLines.map((l) => [l.producerId, l.acceptedQty, l.value])).toEqual([
      ["produtor-A", 180, 1971],
      ["produtor-B", 30, 328.5],
    ]);
  });
});
