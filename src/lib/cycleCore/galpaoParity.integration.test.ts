import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWarehouseDifferenceLines, getWeekFinancialSummary } from "../weekSummary";
import { checkDisposableMarker, checkDisposableTarget } from "../testing/disposableDb";
import { resetDisposableDb } from "../testing/integrationDb";
import { loadCurrentCycle } from "./currentTables";
import { compareGalpao } from "./galpaoParity";

// Ciclo FECHADO fictício num banco descartável (executor npm run
// test:integration): modelo atual × lógica corrigida na parte do galpão,
// custos e diferença, e o script de validação somente leitura de ponta a ponta.
const target = checkDisposableTarget(process.env);
const prisma = new PrismaClient();
let weekNumber = 0;
let weekId = "";

async function assertDisposable() {
  const [row] = await prisma.$queryRaw<{ current_database: string; comment: string | null }[]>`
    SELECT current_database() AS current_database, shobj_description(d.oid, 'pg_database') AS comment
    FROM pg_database d WHERE d.datname = current_database()`;
  checkDisposableMarker(target, { currentDatabase: row.current_database, comment: row.comment }, process.env.COLHEITA_TEST_DB_TOKEN!);
}

beforeAll(async () => {
  await assertDisposable();
  await resetDisposableDb(prisma, target, process.env.COLHEITA_TEST_DB_TOKEN!);
  const [alface, couve, ovos] = await Promise.all([
    prisma.product.create({ data: { slug: "alface-lisa-p", name: "Alface lisa" } }),
    prisma.product.create({ data: { slug: "couve-p", name: "Couve manteiga" } }),
    prisma.product.create({ data: { slug: "ovos", name: "Ovos" } }),
  ]);
  const price = async (productId: string, value: number) => prisma.price.create({ data: { productId, price: value, validFrom: new Date("2020-01-01") } });
  const [pA, pC, pO] = await Promise.all([price(alface.id, 14.62), price(couve.id, 14.6), price(ovos.id, 15.45)]);
  const [s1, s2] = await Promise.all([
    prisma.school.create({ data: { code: "P001", name: "Escola Paridade 1" } }),
    prisma.school.create({ data: { code: "P002", name: "Escola Paridade 2" } }),
  ]);
  const [prod1, prod2, prod3] = await Promise.all([
    prisma.producer.create({ data: { internalId: "PP1", name: "Produtor Paridade 1" } }),
    prisma.producer.create({ data: { internalId: "PP2", name: "Produtor Paridade 2" } }),
    prisma.producer.create({ data: { internalId: "PP3", name: "Produtor Paridade 3" } }),
  ]);
  const reason = await prisma.returnReason.create({ data: { code: 901, description: "Murcho" } });
  const week = await prisma.week.create({
    data: { referenceDate: new Date("2026-08-16"), startDate: new Date("2026-08-16"), endDate: new Date("2026-08-19"), createdAt: new Date("2026-08-13T12:00:00Z") },
  });
  weekId = week.id;
  weekNumber = week.number;
  await prisma.schoolOrder.createMany({
    data: [
      { weekId, schoolId: s1.id, productId: alface.id, orderedQty: 120.5, priceId: pA.id },
      { weekId, schoolId: s2.id, productId: alface.id, orderedQty: 80, priceId: pA.id },
      { weekId, schoolId: s1.id, productId: couve.id, orderedQty: 33.33, priceId: pC.id },
      { weekId, schoolId: s2.id, productId: ovos.id, orderedQty: 12, priceId: pO.id },
    ],
  });
  await prisma.schoolReturn.create({ data: { weekId, schoolId: s1.id, productId: alface.id, returnedQty: 10, returnReasonId: reason.id } });
  const when = new Date("2026-08-17T08:00:00Z");
  await prisma.producerDelivery.createMany({
    data: [
      { weekId, producerId: prod1.id, productId: alface.id, deliveredQty: 150.25, deliveredAt: when, priceId: pA.id, logisticsDeductionSnapshot: 3.67 },
      { weekId, producerId: prod2.id, productId: alface.id, deliveredQty: 60, deliveredAt: when, priceId: pA.id, logisticsDeductionSnapshot: 3.5 },
      { weekId, producerId: prod2.id, productId: couve.id, deliveredQty: 33.33, deliveredAt: when, priceId: pC.id, logisticsDeductionSnapshot: 3.67 },
      { weekId, producerId: prod3.id, productId: ovos.id, deliveredQty: 0, deliveredAt: when, priceId: pO.id, logisticsDeductionSnapshot: 3.67 },
    ],
  });
  await prisma.producerReturn.createMany({
    data: [
      { weekId, producerId: prod1.id, productId: alface.id, returnedQty: 20.25, returnReasonId: reason.id },
      { weekId, producerId: prod2.id, productId: couve.id, returnedQty: 0.33, returnReasonId: reason.id },
    ],
  });
  await prisma.weeklyCost.createMany({
    data: [
      { weekId, category: "TRANSPORTE", amount: 350 },
      { weekId, category: "MONTAGEM", amount: 120.4 },
    ],
  });
  await prisma.week.update({ where: { id: weekId }, data: { status: "FECHADA", closedAt: new Date("2026-08-20T12:00:00Z") } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("validação de ciclo fechado — galpão, custos e diferença", () => {
  it("modelo atual e lógica corrigida dão os mesmos números, linha a linha e no total", async () => {
    const [summary, differenceLines, current] = await Promise.all([getWeekFinancialSummary(weekId), getWarehouseDifferenceLines(weekId), loadCurrentCycle(prisma, weekId)]);
    const report = compareGalpao({ ...summary, differenceLines }, current!);
    expect(report.mismatches).toEqual([]);
    expect(report.anomalies).toEqual([]);
    expect(report.ok).toBe(true);
    // 130 × (14,62 − 3,67) + 60 × (14,62 − 3,50) + 33 × (14,60 − 3,67) + 0 = 1423,50 + 667,20 + 360,69
    expect(summary.producersTotal).toBe(2451.39);
    expect(report.checks.find((c) => c.label === "Total a pagar aos produtores")).toMatchObject({ legacy: 2451.39, novo: 2451.39, ok: true });
    expect(report.checks.find((c) => c.label === "Custos reais registrados")).toMatchObject({ legacy: 470.4, novo: 470.4 });
    expect(report.notValidated[0]).toMatch(/Cobrança da prefeitura pelo aceito na escola: sem base/);
    // O ciclo continua fechado e intocado.
    expect((await prisma.week.findUniqueOrThrow({ where: { id: weekId } })).status).toBe("FECHADA");
  });

  it("acusa devolução no galpão sem entrega (o modelo atual ignora; o núcleo trataria como erro)", async () => {
    const current = (await loadCurrentCycle(prisma, weekId))!;
    const [summary, differenceLines] = await Promise.all([getWeekFinancialSummary(weekId), getWarehouseDifferenceLines(weekId)]);
    const report = compareGalpao({ ...summary, differenceLines }, { ...current, returnsWithoutDelivery: [{ producerId: "x", productId: "y", qty: 5 }] });
    expect(report.ok).toBe(false);
    expect(report.anomalies[0]).toMatch(/devolução de 5 no galpão sem entrega/);
  });

  it("script de validação: conexão somente leitura, relatório OK e nada gravado", async () => {
    const before = await prisma.auditLog.count();
    const run = spawnSync("npx", ["tsx", "scripts/validate-closed-cycle.ts", "--semana", String(weekNumber)], {
      env: { ...process.env, VALIDATION_DATABASE_URL: process.env.DATABASE_URL },
      encoding: "utf8",
    });
    expect(run.stderr).toContain("Conexão somente leitura confirmada");
    expect(run.stderr).not.toContain("postgresql://");
    expect(run.stdout).toContain("Resultado: OK");
    expect(run.stdout).toContain("Não validado (e por quê)");
    expect(run.status).toBe(0);
    expect(await prisma.auditLog.count()).toBe(before);
  }, 60_000);

  it("script recusa ciclo aberto", async () => {
    const open = await prisma.week.create({ data: { referenceDate: new Date("2026-08-23"), startDate: new Date("2026-08-23"), endDate: new Date("2026-08-26") } });
    const run = spawnSync("npx", ["tsx", "scripts/validate-closed-cycle.ts", "--id", open.id], { env: { ...process.env, VALIDATION_DATABASE_URL: process.env.DATABASE_URL }, encoding: "utf8" });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("não está fechado");
  }, 60_000);
});
