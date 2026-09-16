import { PrismaClient } from "@prisma/client";
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

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, logisticsDeductionPerKg: 3.67 },
  });

  for (const p of seedData.products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { name: p.name, pricePerKg: p.pricePerKg },
      create: { slug: p.slug, name: p.name, pricePerKg: p.pricePerKg },
    });
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
