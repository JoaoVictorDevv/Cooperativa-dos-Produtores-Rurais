import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import seedData from "./data/seed-data.json";

const prisma = new PrismaClient();

const MONTH_KEYS = [
  "out",
  "nov",
  "dez",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
] as const;

// Data "epoch" para o preco inicial: qualquer semana lancada a partir de
// hoje encontra um preco vigente. Nao representa uma data real do Excel.
const PRICE_EPOCH = new Date("2020-01-01T00:00:00.000Z");

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, logisticsDeductionPerKg: 3.67 },
  });

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@colheita.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "colheita2026";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Administrador",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });
  console.log(`Usuario admin: ${adminEmail} (senha inicial: ${adminPassword})`);

  for (const p of seedData.products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: { name: p.name },
      create: { slug: p.slug, name: p.name },
    });

    const currentPrice = await prisma.price.findFirst({
      where: { productId: product.id, validTo: null },
    });
    if (!currentPrice) {
      await prisma.price.create({
        data: {
          productId: product.id,
          price: p.pricePerKg,
          validFrom: PRICE_EPOCH,
          validTo: null,
        },
      });
    } else if (Number(currentPrice.price) !== p.pricePerKg) {
      // seed rodado de novo com preco diferente no JSON: fecha o antigo
      // e abre um novo a partir de agora, preservando o historico.
      const now = new Date();
      await prisma.price.update({
        where: { id: currentPrice.id },
        data: { validTo: now },
      });
      await prisma.price.create({
        data: { productId: product.id, price: p.pricePerKg, validFrom: now, validTo: null },
      });
    }
  }
  console.log(`Produtos: ${seedData.products.length}`);

  for (const s of seedData.schools) {
    await prisma.school.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        neighborhood: s.neighborhood,
        address: s.address,
        phone: s.phone,
      },
      create: {
        code: s.code,
        name: s.name,
        neighborhood: s.neighborhood,
        address: s.address,
        phone: s.phone,
      },
    });
  }
  console.log(`Escolas: ${seedData.schools.length}`);

  for (const p of seedData.producers) {
    await prisma.producer.upsert({
      where: { internalId: p.internalId },
      update: { name: p.name, phone: p.phone },
      create: { internalId: p.internalId, name: p.name, phone: p.phone },
    });
  }
  console.log(`Produtores: ${seedData.producers.length}`);

  for (const r of seedData.returnReasons) {
    await prisma.returnReason.upsert({
      where: { code: r.code },
      update: { description: r.description },
      create: { code: r.code, description: r.description },
    });
  }
  console.log(`Motivos: ${seedData.returnReasons.length}`);

  const productBySlug = new Map(
    (await prisma.product.findMany()).map((p) => [p.slug, p.id]),
  );
  const producerByInternalId = new Map(
    (await prisma.producer.findMany()).map((p) => [p.internalId, p.id]),
  );

  for (const entry of seedData.productionMap) {
    const productId = productBySlug.get(entry.productSlug);
    const producerId = producerByInternalId.get(entry.producerInternalId);
    if (!productId || !producerId) {
      console.warn(
        `Pulando entrada do mapa de producao sem match: ${entry.productSlug} / ${entry.producerInternalId}`,
      );
      continue;
    }
    const monthly = Object.fromEntries(
      MONTH_KEYS.map((m) => [m, entry.monthly[m] ?? 0]),
    );
    await prisma.productionMapEntry.upsert({
      where: { productId_producerId: { productId, producerId } },
      update: monthly,
      create: { productId, producerId, ...monthly },
    });
  }
  console.log(`Mapa de producao: ${seedData.productionMap.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
