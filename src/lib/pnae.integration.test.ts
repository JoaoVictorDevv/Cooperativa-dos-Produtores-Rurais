import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getProducerAnnualTotal } from "./pnae";

// Estes testes rodam contra um banco Postgres real e dedicado
// (colheita_test) — nao mockam o Prisma, porque os proprios criterios de
// aceite (historico, preco historico, PNAE) sao sobre persistencia real.
config({ path: resolve(__dirname, "../../.env.test"), override: true });

const prisma = new PrismaClient();

async function resetDb() {
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
        status: "FECHADA",
        closedAt: new Date(),
      },
    });
    await prisma.schoolOrder.create({
      data: { weekId: weekOld.id, schoolId: school.id, productId: product.id, orderedQty: 10, priceId: oldPrice.id },
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

    const weeks = await Promise.all(
      [
        new Date("2026-10-04"),
        new Date("2026-10-11"),
        new Date("2026-10-18"),
      ].map((d, i) =>
        prisma.week.create({
          data: {
            referenceDate: d,
            startDate: d,
            endDate: d,
            status: i < 2 ? "FECHADA" : "ABERTA",
          },
        }),
      ),
    );

    for (const week of weeks) {
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
    }

    // cada semana: 450 * (8 - 3,67) = 1948,50 -> 3 semanas = 5845,50
    const total = await getProducerAnnualTotal(prisma, producer.id, new Date("2026-11-01"));
    expect(total).toBe(5845.5);
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
