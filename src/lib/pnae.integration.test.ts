import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getProducerAnnualTotal } from "./pnae";
import { getWeekFinancialSummary } from "./weekSummary";
import { checkDisposableMarker, checkDisposableTarget } from "./testing/disposableDb";

// Estes testes rodam contra um Postgres real (não mockam o Prisma, porque os
// critérios de aceite são sobre persistência). Só rodam pelo executor
// `npm run test:integration` (scripts/run-integration-tests.mjs), que cria um
// banco novo e exclusivo, marca-o com um código desta execução, aplica as
// migrações e o apaga no fim. Sem essa prova, nada é apagado.
const target = checkDisposableTarget(process.env);

const prisma = new PrismaClient();

let confirmed = false;
async function assertDisposableDatabase() {
  if (confirmed) return;
  const [row] = await prisma.$queryRaw<{ current_database: string; comment: string | null }[]>`
    SELECT current_database() AS current_database,
           shobj_description(d.oid, 'pg_database') AS comment
    FROM pg_database d WHERE d.datname = current_database()`;
  checkDisposableMarker(target, { currentDatabase: row.current_database, comment: row.comment }, process.env.COLHEITA_TEST_DB_TOKEN!);
  confirmed = true;
}

async function resetDb() {
  await assertDisposableDatabase();
  await prisma.auditLog.deleteMany();
  await prisma.weekReopening.deleteMany();
  await prisma.producerReturn.deleteMany();
  await prisma.producerDelivery.deleteMany();
  await prisma.producerOrder.deleteMany();
  await prisma.producerAllocation.deleteMany();
  await prisma.schoolReturn.deleteMany();
  await prisma.schoolDelivery.deleteMany();
  await prisma.schoolOrder.deleteMany();
  await prisma.weeklyCost.deleteMany();
  await prisma.week.deleteMany();
  await prisma.price.deleteMany();
  await prisma.productionMapEntry.deleteMany();
  await prisma.returnReason.deleteMany();
  await prisma.school.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();
}

beforeAll(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("Teste 7 — historico: fechar semana e criar outra", () => {
  it("a primeira semana continua disponivel com os valores originais", async () => {
    const product = await prisma.product.create({ data: { slug: "abacate", name: "Abacate" } });
    const price = await prisma.price.create({
      data: { productId: product.id, price: 8, validFrom: new Date("2026-01-01") },
    });
    const school = await prisma.school.create({ data: { code: "1001", name: "Escola Teste" } });

    const weekA = await prisma.week.create({
      data: {
        referenceDate: new Date("2026-09-13"),
        startDate: new Date("2026-09-13"),
        endDate: new Date("2026-09-15"),
        status: "ABERTA",
      },
    });
    await prisma.schoolOrder.create({
      data: { weekId: weekA.id, schoolId: school.id, productId: product.id, orderedQty: 100, priceId: price.id },
    });

    await prisma.week.update({ where: { id: weekA.id }, data: { status: "FECHADA", closedAt: new Date() } });

    await expect(
      prisma.schoolOrder.update({
        where: { weekId_schoolId_productId: { weekId: weekA.id, schoolId: school.id, productId: product.id } },
        data: { orderedQty: 999 },
      }),
    ).rejects.toThrow("Semana fechada nao pode receber alteracoes");

    const weekB = await prisma.week.create({
      data: {
        referenceDate: new Date("2026-09-20"),
        startDate: new Date("2026-09-20"),
        endDate: new Date("2026-09-22"),
        status: "ABERTA",
      },
    });

    // CA-SEM-02: nada da semana A deve existir na semana B
    const ordersInWeekB = await prisma.schoolOrder.findMany({ where: { weekId: weekB.id } });
    expect(ordersInWeekB).toHaveLength(0);

    // a semana A continua intacta
    const weekAReloaded = await prisma.week.findUniqueOrThrow({
      where: { id: weekA.id },
      include: { schoolOrders: true },
    });
    expect(weekAReloaded.status).toBe("FECHADA");
    expect(weekAReloaded.schoolOrders).toHaveLength(1);
    expect(Number(weekAReloaded.schoolOrders[0].orderedQty)).toBe(100);
  });
});

describe("Teste 8 — preco historico", () => {
  it("alterar o preco para uma semana futura nao muda semanas antigas", async () => {
    const product = await prisma.product.create({ data: { slug: "abacate", name: "Abacate" } });
    const oldPrice = await prisma.price.create({
      data: { productId: product.id, price: 8, validFrom: new Date("2020-01-01") },
    });
    const school = await prisma.school.create({ data: { code: "1001", name: "Escola Teste" } });

    const weekOld = await prisma.week.create({
      data: {
        referenceDate: new Date("2026-01-01"),
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-03"),
        status: "ABERTA",
      },
    });
    await prisma.schoolOrder.create({
      data: { weekId: weekOld.id, schoolId: school.id, productId: product.id, orderedQty: 10, priceId: oldPrice.id },
    });
    await prisma.week.update({
      where: { id: weekOld.id },
      data: { status: "FECHADA", closedAt: new Date() },
    });

    // "altera" o preco: fecha o antigo e abre um novo a partir de agora
    const changeDate = new Date("2026-06-01");
    await prisma.price.update({ where: { id: oldPrice.id }, data: { validTo: changeDate } });
    const newPrice = await prisma.price.create({
      data: { productId: product.id, price: 12, validFrom: changeDate },
    });

    const weekNew = await prisma.week.create({
      data: {
        referenceDate: new Date("2026-07-01"),
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-03"),
        status: "ABERTA",
      },
    });
    await prisma.schoolOrder.create({
      data: { weekId: weekNew.id, schoolId: school.id, productId: product.id, orderedQty: 10, priceId: newPrice.id },
    });

    const oldOrder = await prisma.schoolOrder.findFirstOrThrow({
      where: { weekId: weekOld.id },
      include: { price: true },
    });
    const newOrder = await prisma.schoolOrder.findFirstOrThrow({
      where: { weekId: weekNew.id },
      include: { price: true },
    });

    expect(Number(oldOrder.price.price)).toBe(8);
    expect(Number(newOrder.price.price)).toBe(12);
  });
});

describe("Teste 9 — PNAE acumula automaticamente entre semanas", () => {
  it("soma os pagamentos de varias semanas para o mesmo produtor", async () => {
    const product = await prisma.product.create({ data: { slug: "abacate", name: "Abacate" } });
    const price = await prisma.price.create({
      data: { productId: product.id, price: 8, validFrom: new Date("2020-01-01") },
    });
    const producer = await prisma.producer.create({ data: { internalId: "P01", name: "Produtor Teste" } });

    const dates = [new Date("2026-10-04"), new Date("2026-10-11"), new Date("2026-10-18")];
    for (const [index, date] of dates.entries()) {
      const week = await prisma.week.create({
        data: {
          referenceDate: date,
          startDate: date,
          endDate: date,
          status: "ABERTA",
        },
      });
      await prisma.producerDelivery.create({
        data: {
          weekId: week.id,
          producerId: producer.id,
          productId: product.id,
          deliveredQty: 450,
          deliveredAt: week.startDate,
          priceId: price.id,
          logisticsDeductionSnapshot: 3.67,
        },
      });
      if (index < dates.length - 1) {
        await prisma.week.update({
          where: { id: week.id },
          data: { status: "FECHADA", closedAt: new Date() },
        });
      }
    }

    // cada semana: 450 * (8 - 3,67) = 1948,50 -> 3 semanas = 5845,50
    const total = await getProducerAnnualTotal(prisma, producer.id, new Date("2026-11-01"));
    expect(total).toBe(5845.5);
  });

  it("associa devolucao ao ciclo da entrega mesmo quando digitada depois", async () => {
    const product = await prisma.product.create({ data: { slug: "tomate", name: "Tomate" } });
    const price = await prisma.price.create({
      data: { productId: product.id, price: 10, validFrom: new Date("2020-01-01") },
    });
    const producer = await prisma.producer.create({ data: { internalId: "P02", name: "Produtor Dois" } });
    const reason = await prisma.returnReason.create({ data: { code: 1, description: "Qualidade" } });
    const week = await prisma.week.create({
      data: {
        referenceDate: new Date("2026-10-04"),
        startDate: new Date("2026-10-04"),
        endDate: new Date("2026-10-06"),
      },
    });
    await prisma.producerDelivery.create({
      data: {
        weekId: week.id,
        producerId: producer.id,
        productId: product.id,
        deliveredQty: 100,
        deliveredAt: week.startDate,
        priceId: price.id,
        logisticsDeductionSnapshot: 3.67,
      },
    });
    await prisma.producerReturn.create({
      data: {
        weekId: week.id,
        producerId: producer.id,
        productId: product.id,
        returnedQty: 10,
        returnReasonId: reason.id,
        createdAt: new Date("2027-10-10"),
      },
    });

    const total = await getProducerAnnualTotal(prisma, producer.id, new Date("2026-11-01"));
    expect(total).toBe(569.7);
  });
});

describe("Teste 10 — datas de domingo/segunda/terca", () => {
  it("cada operacao aparece com sua data correta", async () => {
    const product = await prisma.product.create({ data: { slug: "abacate", name: "Abacate" } });
    const price = await prisma.price.create({
      data: { productId: product.id, price: 8, validFrom: new Date("2020-01-01") },
    });
    const producer = await prisma.producer.create({ data: { internalId: "P01", name: "Produtor Teste" } });
    const schoolA = await prisma.school.create({ data: { code: "1001", name: "Escola A" } });
    const schoolB = await prisma.school.create({ data: { code: "1002", name: "Escola B" } });

    const domingo = new Date("2026-09-13");
    const segunda = new Date("2026-09-14");
    const terca = new Date("2026-09-15");

    const week = await prisma.week.create({
      data: { referenceDate: domingo, startDate: domingo, endDate: terca, status: "ABERTA" },
    });

    await prisma.producerDelivery.create({
      data: {
        weekId: week.id,
        producerId: producer.id,
        productId: product.id,
        deliveredQty: 100,
        deliveredAt: domingo,
        priceId: price.id,
        logisticsDeductionSnapshot: 3.67,
      },
    });
    await prisma.schoolDelivery.create({
      data: { weekId: week.id, schoolId: schoolA.id, weekday: "SEGUNDA", deliveredAt: segunda },
    });
    await prisma.schoolDelivery.create({
      data: { weekId: week.id, schoolId: schoolB.id, weekday: "TERCA", deliveredAt: terca },
    });

    const delivery = await prisma.producerDelivery.findFirstOrThrow({ where: { weekId: week.id } });
    const deliveryA = await prisma.schoolDelivery.findFirstOrThrow({ where: { schoolId: schoolA.id } });
    const deliveryB = await prisma.schoolDelivery.findFirstOrThrow({ where: { schoolId: schoolB.id } });

    expect(delivery.deliveredAt.toISOString().slice(0, 10)).toBe("2026-09-13");
    expect(deliveryA.weekday).toBe("SEGUNDA");
    expect(deliveryA.deliveredAt.toISOString().slice(0, 10)).toBe("2026-09-14");
    expect(deliveryB.weekday).toBe("TERCA");
    expect(deliveryB.deliveredAt.toISOString().slice(0, 10)).toBe("2026-09-15");
  });
});

describe("Arredondamento do total a cobrar — só ciclos novos (decisão 26/09/2026)", () => {
  it("ciclo antigo fechado mantém o total antigo; ciclo novo soma as linhas arredondadas", async () => {
    const product = await prisma.product.create({ data: { slug: "abacate", name: "Abacate" } });
    const price = await prisma.price.create({ data: { productId: product.id, price: 10.05, validFrom: new Date("2020-01-01") } });
    const schools = await Promise.all(
      ["1001", "1002", "1003"].map((code) => prisma.school.create({ data: { code, name: `Escola ${code}` } })),
    );

    async function weekWithOrders(createdAt: Date, start: string) {
      const week = await prisma.week.create({
        data: { referenceDate: new Date(start), startDate: new Date(start), endDate: new Date(start), status: "ABERTA", createdAt },
      });
      for (const s of schools) {
        await prisma.schoolOrder.create({ data: { weekId: week.id, schoolId: s.id, productId: product.id, orderedQty: 0.33, priceId: price.id } });
      }
      return week;
    }

    const antigo = await weekWithOrders(new Date("2026-09-20T12:00:00Z"), "2026-09-20");
    await prisma.week.update({ where: { id: antigo.id }, data: { status: "FECHADA", closedAt: new Date() } });
    const novo = await weekWithOrders(new Date("2026-09-28T12:00:00Z"), "2026-09-28");

    const a = await getWeekFinancialSummary(antigo.id);
    const n = await getWeekFinancialSummary(novo.id);
    expect(a.treasuryRounding).toBe("TOTAL_LEGADO");
    expect(a.treasuryTotal).toBe(9.95);
    expect(n.treasuryRounding).toBe("POR_LINHA");
    expect(n.treasuryTotal).toBe(9.96);
    expect(n.treasuryLines.reduce((sum, l) => sum + l.value, 0)).toBeCloseTo(n.treasuryTotal, 10);
  });
});
